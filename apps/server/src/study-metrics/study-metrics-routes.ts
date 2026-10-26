import { z } from "zod";
import {
  studyMetricsQuerySchema,
  studyMetricsListQuerySchema,
  studyMetricsViewSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import type { Database } from "../database/client.ts";
import { sendValidationError } from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import { validateMetricsRange } from "./metrics-calendar.ts";
import {
  getMetricsCollections,
  getStudyAttempts,
  getStudyMetrics,
  getStudyRanking,
  ownsMetricsCollection,
} from "./study-metrics-queries.ts";

export const createStudyMetricsRoutes =
  ({ auth, database }: { auth: Auth; database: Database }): FastifyPluginAsync =>
  async (app) => {
    const limiter = createRequestRateLimiter({ limit: 120, windowMs: 60000 });
    const options = z.object({
      query: z.string().max(100).default(""),
      selectedId: z.uuid().optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1),
    });
    app.get<{ Params: { view: string } }>(
      "/api/study-metrics/:view/collections",
      async (request, reply) => {
        const session = await requireSession(auth, request, reply);
        if (!session) return;
        if (!limiter.consume(session.user.id))
          return reply.status(429).send({
            code: "RATE_LIMITED",
            message: "Aguarde um momento antes de consultar novamente.",
          });
        const view = z.enum(["flashcards", "quizzes"]).safeParse(request.params.view);
        const input = options.safeParse(request.query);
        if (!view.success || !input.success) return sendValidationError(reply);
        reply.header("cache-control", "private, no-store");
        return getMetricsCollections(
          database,
          session.user.id,
          view.data,
          input.data.query,
          input.data.page,
          input.data.selectedId,
        );
      },
    );
    for (const region of ["summary", "ranking", "attempts"] as const) {
      app.get<{ Params: { view: string } }>(
        `/api/study-metrics/:view/${region}`,
        async (request, reply) => {
          const session = await requireSession(auth, request, reply);
          if (!session) return;
          if (!limiter.consume(session.user.id))
            return reply.status(429).send({
              code: "RATE_LIMITED",
              message: "Aguarde um momento antes de consultar novamente.",
            });
          const view = studyMetricsViewSchema.safeParse(request.params.view);
          const input = studyMetricsListQuerySchema.safeParse(request.query);
          if (
            !view.success ||
            !input.success ||
            !validateMetricsRange(input.data.from, input.data.to, input.data.tz)
          )
            return sendValidationError(reply);
          if (
            (region !== "summary" && view.data === "overview") ||
            (region === "attempts" && view.data !== "quizzes")
          )
            return sendValidationError(reply);
          if (
            input.data.collectionId &&
            !(await ownsMetricsCollection(
              database,
              session.user.id,
              view.data,
              input.data.collectionId,
            ))
          )
            return reply.status(404).send({ code: "COLLECTION_NOT_FOUND" });
          reply.header("cache-control", "private, no-store");
          if (region === "ranking")
            return getStudyRanking(
              database,
              session.user.id,
              input.data,
              view.data as "flashcards" | "quizzes",
            );
          if (region === "attempts") return getStudyAttempts(database, session.user.id, input.data);
          return getStudyMetrics(
            database,
            session.user.id,
            studyMetricsQuerySchema.parse(input.data),
            view.data,
          );
        },
      );
    }
  };
