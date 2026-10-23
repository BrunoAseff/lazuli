import {
  favoriteTargetSchema,
  favoriteStateRequestSchema,
  favoriteStatesSchema,
  favoriteListSchema,
  favoriteListQuerySchema,
} from "@lazuli/shared";
import { and, eq, or } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { userFavorite } from "../database/schema/index.ts";
import { requireSession } from "../auth/require-session.ts";
import { createMutationAuthorizer, sendValidationError } from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import { listFavorites, setFavorite } from "./favorite-queries.ts";

export const createFavoriteRoutes =
  ({
    auth,
    database,
    websiteUrl,
  }: {
    auth: Auth;
    database: Database;
    websiteUrl: string;
  }): FastifyPluginAsync =>
  async (app) => {
    const authorize = createMutationAuthorizer(
      auth,
      websiteUrl,
      createRequestRateLimiter({ limit: 120, windowMs: 60_000 }),
    );
    app.get("/api/favorites", async (request, reply) => {
      const current = await requireSession(auth, request, reply);
      if (!current) return;
      const input = favoriteListQuerySchema.safeParse(request.query);
      if (!input.success) return sendValidationError(reply);
      return favoriteListSchema.parse(
        await listFavorites(database, current.user.id, input.data.page, input.data.kind),
      );
    });
    app.post("/api/favorites/states", async (request, reply) => {
      const current = await authorize(request, reply);
      if (!current) return;
      const input = favoriteStateRequestSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      if (!input.data.targets.length) return { items: [] };
      const columns = {
        project: userFavorite.projectId,
        document: userFavorite.documentId,
        flashcards: userFavorite.flashcardCollectionId,
        quizzes: userFavorite.quizCollectionId,
      };
      const rows = await database
        .select()
        .from(userFavorite)
        .where(
          and(
            eq(userFavorite.userId, current.user.id),
            or(...input.data.targets.map((target) => eq(columns[target.kind], target.id))),
          ),
        );
      return favoriteStatesSchema.parse({
        items: rows.map((row) => {
          const kind = row.projectId
            ? "project"
            : row.documentId
              ? "document"
              : row.flashcardCollectionId
                ? "flashcards"
                : "quizzes";
          const id =
            kind === "project"
              ? row.projectId
              : kind === "document"
                ? row.documentId
                : kind === "flashcards"
                  ? row.flashcardCollectionId
                  : row.quizCollectionId;
          return { kind, id };
        }),
      });
    });
    for (const method of ["PUT", "DELETE"] as const)
      app.route<{ Params: { kind: string; id: string } }>({
        method,
        url: "/api/favorites/:kind/:id",
        handler: async (request, reply) => {
          const current = await authorize(request, reply);
          if (!current) return;
          const input = favoriteTargetSchema.safeParse(request.params);
          if (!input.success) return sendValidationError(reply);
          if (!(await setFavorite(database, current.user.id, input.data, method === "PUT")))
            return reply.status(404).send({ code: "NOT_FOUND" });
          return { success: true };
        },
      });
  };
