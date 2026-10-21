import {
  dashboardOnboardingDismissalSchema,
  dashboardQuerySchema,
  dashboardResponseSchema,
  dismissDashboardOnboardingSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import type { Database } from "../database/client.ts";
import { createMutationAuthorizer, sendValidationError } from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import { dismissDashboardOnboarding, getDashboard } from "./dashboard-queries.ts";

type DashboardRoutesOptions = { auth: Auth; database: Database; websiteUrl: string };

const normalizeTimeZone = (value?: string) => {
  if (!value) return "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

export const createDashboardRoutes = ({
  auth,
  database,
  websiteUrl,
}: DashboardRoutesOptions): FastifyPluginAsync =>
  async function dashboardRoutes(app) {
    const mutationLimiter = createRequestRateLimiter({ limit: 30, windowMs: 10 * 60 * 1_000 });
    const authorizeMutation = createMutationAuthorizer(auth, websiteUrl, mutationLimiter);

    app.get("/api/dashboard", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const input = dashboardQuerySchema.safeParse(request.query);
      if (!input.success) return sendValidationError(reply);
      const timeZone = normalizeTimeZone(input.data.tz);
      if (!timeZone) return sendValidationError(reply);
      try {
        return dashboardResponseSchema.parse(
          await getDashboard(database, session.user.id, timeZone),
        );
      } catch (error) {
        request.log.error({ err: error, userId: session.user.id }, "dashboard loading failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível carregar seu início.",
        });
      }
    });

    app.patch("/api/dashboard/onboarding", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const input = dismissDashboardOnboardingSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      try {
        const result = await dismissDashboardOnboarding(database, session.user.id);
        return dashboardOnboardingDismissalSchema.parse({
          dismissedAt: result.dismissedAt.toISOString(),
        });
      } catch (error) {
        request.log.error(
          { err: error, userId: session.user.id },
          "dashboard onboarding dismissal failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível ocultar esta orientação.",
        });
      }
    });
  };
