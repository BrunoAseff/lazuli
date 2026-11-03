import type { preHandlerHookHandler } from "fastify";
import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import type { LegalStatus } from "@lazuli/shared";

// These operations remain reachable without accepting a contract. Match routes, not user-supplied prefixes.
const essentialRoutes = new Set([
  "GET /api/account-settings/profile",
  "GET /api/account-settings/sessions",
  "DELETE /api/account-settings/sessions",
  "DELETE /api/account-settings/sessions/:sessionId",
  "POST /api/account-exports",
  "DELETE /api/account",
  "GET /api/analytics/preferences",
  "PUT /api/analytics/preferences",
  "GET /api/billing/summary",
  "GET /api/billing/plans",
  "POST /api/billing/summary/refresh",
  "POST /api/billing/portal-sessions",
]);

export const isEssentialLegalRoute = (method: string, route: string) =>
  essentialRoutes.has(`${method} ${route}`);

export const createLegalAccessGuard =
  (auth: Auth, status: (userId: string) => Promise<LegalStatus>): preHandlerHookHandler =>
  async (request, reply) => {
    const route = request.routeOptions.url ?? "";
    if (
      !route.startsWith("/api/") ||
      route.startsWith("/api/auth/") ||
      route.startsWith("/api/legal/") ||
      route === "/api/billing/webhooks/stripe" ||
      route === "/api/health" ||
      request.method === "OPTIONS" ||
      isEssentialLegalRoute(request.method, route)
    )
      return;
    const session = await requireSession(auth, request, reply);
    if (!session) return;
    if (!(await status(session.user.id)).accepted)
      return reply.code(403).send({
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        message: "Confirme os Termos de Uso para continuar.",
      });
  };
