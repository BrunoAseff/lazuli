import { acceptLegalSchema, legalStatusSchema } from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import { getLegalStatus, isCurrentLegalEdition, recordLegalAcceptance } from "./legal-service.ts";

export const createLegalRoutes =
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
    const limiter = createRequestRateLimiter({ limit: 20, windowMs: 60_000 });
    app.get("/api/legal/status", async (request, reply) => {
      reply.header("cache-control", "private, no-store");
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      return legalStatusSchema.parse(await getLegalStatus(database, session.user.id));
    });
    app.post("/api/legal/acceptance", async (request, reply) => {
      reply.header("cache-control", "private, no-store");
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      if (!limiter.consume(session.user.id))
        return reply.code(429).send({ code: "LEGAL_RATE_LIMITED" });
      const parsed = acceptLegalSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ code: "INVALID_LEGAL_ACCEPTANCE" });
      if (!isCurrentLegalEdition(parsed.data))
        return reply.code(409).send({ code: "LEGAL_VERSION_CHANGED" });
      const result = await recordLegalAcceptance(database, session.user.id, "account-gate");
      return legalStatusSchema.parse(result);
    });
  };
