import {
  accountSessionsSchema,
  appearancePreferenceSchema,
  accountSettingsProfileSchema,
  createAccountExportSchema,
  deleteAccountSchema,
  studyPreferenceSchema,
  updateStudyPreferenceSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";
import { APIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import { userInterfacePreference } from "../database/schema/index.ts";
import { getAccountUsage } from "./account-usage.ts";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import type { Database } from "../database/client.ts";
import { createMutationAuthorizer, sendValidationError } from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import {
  createAccountExport,
  getAccountProfile,
  getStudyPreference,
  listSafeSessions,
  revokeOtherOwnedSessions,
  revokeOwnedSession,
  updateStudyPreference,
} from "./account-settings-queries.ts";

type Options = {
  auth: Auth;
  database: Database;
  googleEnabled: boolean;
  rollbackAccountDeletion?: (userId: string) => void;
  websiteUrl: string;
};

export const createAccountSettingsRoutes = ({
  auth,
  database,
  googleEnabled,
  rollbackAccountDeletion,
  websiteUrl,
}: Options): FastifyPluginAsync =>
  async function accountSettingsRoutes(app) {
    const mutationLimiter = createRequestRateLimiter({ limit: 40, windowMs: 10 * 60_000 });
    const sensitiveLimiter = createRequestRateLimiter({ limit: 6, windowMs: 60 * 60_000 });
    const sessionRevocationLimiter = createRequestRateLimiter({ limit: 20, windowMs: 10 * 60_000 });
    const authorizeMutation = createMutationAuthorizer(auth, websiteUrl, mutationLimiter);
    const authorizeSensitiveMutation = createMutationAuthorizer(auth, websiteUrl, sensitiveLimiter);
    const authorizeSessionRevocation = createMutationAuthorizer(
      auth,
      websiteUrl,
      sessionRevocationLimiter,
      {
        code: "SESSION_REVOCATION_RATE_LIMITED",
        message: "Muitas sessões foram encerradas em pouco tempo. Aguarde e tente novamente.",
      },
    );

    app.get("/api/account-settings/profile", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const profile = await getAccountProfile(database, session.user.id, googleEnabled);
      if (!profile) return reply.status(404).send({ code: "ACCOUNT_NOT_FOUND" });
      return accountSettingsProfileSchema.parse(profile);
    });

    app.get("/api/account-settings/usage", async (request, reply) => {
      const current = await requireSession(auth, request, reply);
      if (current) return getAccountUsage(database, current.user.id);
    });

    app.get("/api/account-settings/appearance", async (request, reply) => {
      const current = await requireSession(auth, request, reply);
      if (!current) return;
      const [preference] = await database
        .select({ theme: userInterfacePreference.theme })
        .from(userInterfacePreference)
        .where(eq(userInterfacePreference.userId, current.user.id))
        .limit(1);
      return appearancePreferenceSchema.parse(preference ?? { theme: "system" });
    });

    app.put("/api/account-settings/appearance", async (request, reply) => {
      const current = await authorizeMutation(request, reply);
      if (!current) return;
      const input = appearancePreferenceSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      await database
        .insert(userInterfacePreference)
        .values({ userId: current.user.id, ...input.data })
        .onConflictDoUpdate({
          target: userInterfacePreference.userId,
          set: { ...input.data, updatedAt: new Date() },
        });
      return input.data;
    });

    app.get("/api/account-settings/study", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      return studyPreferenceSchema.parse(await getStudyPreference(database, session.user.id));
    });

    app.put("/api/account-settings/study", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const input = updateStudyPreferenceSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      return studyPreferenceSchema.parse(
        await updateStudyPreference(database, session.user.id, input.data.desiredRetention),
      );
    });

    app.get("/api/account-settings/sessions", async (request, reply) => {
      const current = await requireSession(auth, request, reply);
      if (!current) return;
      return accountSessionsSchema.parse(
        await listSafeSessions(database, current.user.id, current.session.id),
      );
    });

    app.delete<{ Params: { sessionId: string } }>(
      "/api/account-settings/sessions/:sessionId",
      async (request, reply) => {
        const current = await authorizeSessionRevocation(request, reply);
        if (!current) return;
        const revoked = await revokeOwnedSession(
          database,
          current.user.id,
          request.params.sessionId,
        );
        if (!revoked) return reply.status(404).send({ code: "SESSION_NOT_FOUND" });
        return { current: current.session.id === request.params.sessionId, success: true };
      },
    );

    app.delete("/api/account-settings/sessions", async (request, reply) => {
      const current = await authorizeSessionRevocation(request, reply);
      if (!current) return;
      await revokeOtherOwnedSessions(database, current.user.id, current.session.id);
      return { success: true };
    });

    app.post("/api/account-exports", async (request, reply) => {
      const session = await authorizeSensitiveMutation(request, reply);
      if (!session) return;
      const input = createAccountExportSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      const id = await createAccountExport(database, session.user.id, input.data.categories);
      if (!id)
        return reply.status(409).send({
          code: "EXPORT_ALREADY_RUNNING",
          message: "Uma exportação já está sendo preparada.",
        });
      return reply.status(202).send({ success: true });
    });

    app.delete("/api/account", async (request, reply) => {
      const current = await authorizeSensitiveMutation(request, reply);
      if (!current) return;
      const input = deleteAccountSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      if (input.data.confirmationEmail.trim().toLowerCase() !== current.user.email.toLowerCase())
        return reply.status(400).send({ code: "ACCOUNT_CONFIRMATION_MISMATCH" });
      try {
        await auth.api.deleteUser({
          body: input.data.password ? { password: input.data.password } : {},
          headers: fromNodeHeaders(request.headers),
        });
        return { success: true };
      } catch (error) {
        rollbackAccountDeletion?.(current.user.id);
        const authCode = error instanceof APIError ? error.body?.code : undefined;
        if (authCode === "INVALID_PASSWORD" || authCode === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
          request.log.warn({ authCode, userId: current.user.id }, "account deletion rejected");
          return reply.status(400).send({
            code: "ACCOUNT_REAUTHENTICATION_FAILED",
            message: "Não foi possível confirmar sua identidade.",
          });
        }
        if (authCode === "SESSION_EXPIRED" || authCode === "SESSION_NOT_FRESH") {
          request.log.warn({ authCode, userId: current.user.id }, "account deletion rejected");
          return reply.status(400).send({
            code: "FRESH_SESSION_REQUIRED",
            message: "Não foi possível confirmar sua identidade.",
          });
        }
        request.log.error({ err: error, userId: current.user.id }, "account deletion failed");
        return reply.status(500).send({
          code: "ACCOUNT_DELETION_FAILED",
          message: "Não foi possível excluir a conta. Tente novamente.",
        });
      }
    });
  };
