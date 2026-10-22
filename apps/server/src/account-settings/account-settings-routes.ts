import {
  accountSessionsSchema,
  accountSettingsProfileSchema,
  createAccountExportSchema,
  deleteAccountSchema,
  studyPreferenceSchema,
  updateStudyPreferenceSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";
import { fromNodeHeaders } from "better-auth/node";

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
    const authorizeMutation = createMutationAuthorizer(auth, websiteUrl, mutationLimiter);
    const authorizeSensitiveMutation = createMutationAuthorizer(auth, websiteUrl, sensitiveLimiter);

    app.get("/api/account-settings/profile", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const profile = await getAccountProfile(database, session.user.id, googleEnabled);
      if (!profile) return reply.status(404).send({ code: "ACCOUNT_NOT_FOUND" });
      return accountSettingsProfileSchema.parse(profile);
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
        const current = await authorizeSensitiveMutation(request, reply);
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
      const current = await authorizeSensitiveMutation(request, reply);
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
        request.log.warn({ err: error, userId: current.user.id }, "account deletion rejected");
        return reply.status(400).send({
          code: input.data.password ? "ACCOUNT_REAUTHENTICATION_FAILED" : "FRESH_SESSION_REQUIRED",
          message: "Não foi possível confirmar sua identidade.",
        });
      }
    });
  };
