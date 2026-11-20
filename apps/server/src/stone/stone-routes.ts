import {
  stoneContributionSchema,
  stoneQuerySchema,
  stoneResponseSchema,
  stoneSessionKindSchema,
  updateStudyGoalSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { normalizeTimeZone } from "../dashboard/dashboard-routes.ts";
import type { Database } from "../database/client.ts";
import { createMutationAuthorizer, sendValidationError } from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import { getStone, getStoneContribution, updateStudyGoal } from "./stone-queries.ts";

type StoneRoutesOptions = { auth: Auth; database: Database; websiteUrl: string };

const contributionParamsSchema = z.object({
  kind: stoneSessionKindSchema,
  id: z.string().trim().min(1).max(100),
});

export const createStoneRoutes = ({
  auth,
  database,
  websiteUrl,
}: StoneRoutesOptions): FastifyPluginAsync =>
  async function stoneRoutes(app) {
    const mutationLimiter = createRequestRateLimiter({ limit: 30, windowMs: 10 * 60 * 1_000 });
    const authorizeMutation = createMutationAuthorizer(auth, websiteUrl, mutationLimiter);

    app.get("/api/stone", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const input = stoneQuerySchema.safeParse(request.query);
      if (!input.success) return sendValidationError(reply);
      const timeZone = normalizeTimeZone(input.data.tz);
      if (!timeZone) return sendValidationError(reply);
      try {
        return stoneResponseSchema.parse(await getStone(database, session.user.id, timeZone));
      } catch (error) {
        request.log.error({ err: error, userId: session.user.id }, "stone loading failed");
        return reply
          .status(500)
          .send({ code: "INTERNAL_ERROR", message: "Não foi possível carregar sua pedra." });
      }
    });

    app.get("/api/stone/contribution/:kind/:id", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const params = contributionParamsSchema.safeParse(request.params);
      const input = stoneQuerySchema.safeParse(request.query);
      if (!params.success || !input.success) return sendValidationError(reply);
      const timeZone = normalizeTimeZone(input.data.tz);
      if (!timeZone) return sendValidationError(reply);
      try {
        const contribution = await getStoneContribution(
          database,
          session.user.id,
          params.data.kind,
          params.data.id,
          timeZone,
        );
        if (!contribution)
          return reply
            .status(404)
            .send({ code: "NOT_FOUND", message: "Sessão de estudo não encontrada." });
        return stoneContributionSchema.parse(contribution);
      } catch (error) {
        request.log.error({ err: error, userId: session.user.id }, "stone contribution failed");
        return reply
          .status(500)
          .send({ code: "INTERNAL_ERROR", message: "Não foi possível carregar o progresso." });
      }
    });

    app.put("/api/stone/goal", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const input = updateStudyGoalSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      try {
        return { goal: await updateStudyGoal(database, session.user.id, input.data.goal) };
      } catch (error) {
        request.log.error({ err: error, userId: session.user.id }, "study goal update failed");
        return reply
          .status(500)
          .send({ code: "INTERNAL_ERROR", message: "Não foi possível salvar a meta." });
      }
    });
  };
