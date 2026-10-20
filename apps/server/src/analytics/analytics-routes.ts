import { analyticsPreferenceSchema, updateAnalyticsPreferenceSchema } from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import { sendValidationError } from "../routes/route-helpers.ts";
import { getAnalyticsPreference, updateAnalyticsPreference } from "./analytics-preferences.ts";

export const createAnalyticsRoutes = ({
  auth,
  database,
  websiteUrl,
}: {
  auth: Auth;
  database: Database;
  websiteUrl: string;
}): FastifyPluginAsync =>
  async function analyticsRoutes(app) {
    app.get("/api/analytics/preferences", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      return analyticsPreferenceSchema.parse(
        await getAnalyticsPreference(database, session.user.id),
      );
    });

    app.put("/api/analytics/preferences", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const input = updateAnalyticsPreferenceSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      return analyticsPreferenceSchema.parse(
        await updateAnalyticsPreference(database, session.user.id, input.data),
      );
    });
  };
