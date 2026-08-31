import {
  createReferencesSchema,
  referenceIdSchema,
  referenceListQuerySchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import { createReferences, deleteReference, listReferences } from "./reference-queries.ts";

type Options = { auth: Auth; database: Database; websiteUrl: string };
const validationError = (reply: FastifyReply) =>
  reply
    .status(400)
    .send({ code: "VALIDATION_ERROR", message: "Revise os dados informados e tente novamente." });

export const createReferenceRoutes =
  ({ auth, database, websiteUrl }: Options): FastifyPluginAsync =>
  async (app) => {
    const limiter = createRequestRateLimiter({ limit: 120, windowMs: 10 * 60_000 });
    const mutationSession = async (
      request: Parameters<typeof requireSession>[1],
      reply: FastifyReply,
    ) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return null;
      const session = await requireSession(auth, request, reply);
      if (!session) return null;
      if (!limiter.consume(session.user.id)) {
        reply.status(429).send({
          code: "RATE_LIMITED",
          message: "Muitas referências foram alteradas. Aguarde e tente novamente.",
        });
        return null;
      }
      return session;
    };

    app.get("/api/references", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const input = referenceListQuerySchema.safeParse(request.query);
      if (!input.success) return validationError(reply);
      return listReferences(database, session.user.id, input.data);
    });

    app.post("/api/references", async (request, reply) => {
      const session = await mutationSession(request, reply);
      if (!session) return;
      const input = createReferencesSchema.safeParse(request.body);
      if (!input.success) return validationError(reply);
      const result = await createReferences(database, session.user.id, input.data);
      if (result.kind === "not-found")
        return reply.status(404).send({
          code: "REFERENCE_TARGET_NOT_FOUND",
          message: "O documento ou material não está disponível.",
        });
      if (result.kind === "anchor-not-found")
        return reply.status(409).send({
          code: "REFERENCE_ANCHOR_NOT_FOUND",
          message: "Salve o trecho selecionado antes de criar a referência.",
        });
      if (result.kind === "limit")
        return reply.status(409).send({
          code: "REFERENCE_LIMIT_REACHED",
          message: "Um dos materiais atingiu o limite de referências.",
        });
      return reply.status(result.created ? 201 : 200).send({
        created: result.created,
        items: result.items,
      });
    });

    app.delete("/api/references/:referenceId", async (request, reply) => {
      const session = await mutationSession(request, reply);
      if (!session) return;
      const referenceId = referenceIdSchema.safeParse(
        (request.params as { referenceId?: unknown }).referenceId,
      );
      if (!referenceId.success) return validationError(reply);
      const result = await deleteReference(database, session.user.id, referenceId.data);
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "REFERENCE_NOT_FOUND", message: "Esta referência não foi encontrada." });
      return reply.status(204).send();
    });
  };
