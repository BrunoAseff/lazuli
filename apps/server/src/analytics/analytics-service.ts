import {
  analyticsEventSchemas,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "@lazuli/shared";
import type { FastifyBaseLogger } from "fastify";
import { PostHog } from "posthog-node";

import type { ServerEnv } from "../config.ts";
import type { Database } from "../database/client.ts";
import { getAnalyticsPreference } from "./analytics-preferences.ts";

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;

export const createAnalyticsService = (
  env: ServerEnv,
  database: Database,
  logger: FastifyBaseLogger,
) => {
  const enabled =
    env.NODE_ENV === "production" && env.ANALYTICS_ENABLED && Boolean(env.POSTHOG_API_KEY);
  const client = enabled
    ? new PostHog(env.POSTHOG_API_KEY!, {
        host: env.POSTHOG_HOST,
        flushAt: 20,
        flushInterval: 10_000,
      })
    : null;

  const capture = async <Name extends AnalyticsEventName>(
    userId: string,
    event: Name,
    properties: AnalyticsEventProperties[Name],
  ) => {
    if (!client) return;
    try {
      const preference = await getAnalyticsPreference(database, userId);
      if (preference.status !== "granted") return;
      const validatedProperties = analyticsEventSchemas[event].parse(properties);
      client.capture({
        distinctId: userId,
        event,
        properties: { ...validatedProperties, $process_person_profile: false },
        disableGeoip: true,
      });
    } catch (error) {
      logger.warn({ err: error, event }, "analytics capture failed");
    }
  };

  return {
    capture,
    shutdown: async () => client?.shutdown(),
  };
};
