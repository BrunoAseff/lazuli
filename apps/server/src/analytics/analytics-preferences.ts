import {
  ANALYTICS_CONSENT_VERSION,
  type AnalyticsPreference,
  type UpdateAnalyticsPreference,
} from "@lazuli/shared";
import { eq } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { userAnalyticsPreference } from "../database/schema/analytics.ts";

const serialize = (
  value: typeof userAnalyticsPreference.$inferSelect | undefined,
): AnalyticsPreference => ({
  status: value?.version === ANALYTICS_CONSENT_VERSION ? value.status : "undecided",
  version: ANALYTICS_CONSENT_VERSION,
  decidedAt: value?.version === ANALYTICS_CONSENT_VERSION ? value.decidedAt.toISOString() : null,
});

export const getAnalyticsPreference = async (database: Database, userId: string) =>
  serialize(
    await database.query.userAnalyticsPreference.findFirst({
      where: eq(userAnalyticsPreference.userId, userId),
    }),
  );

export const updateAnalyticsPreference = async (
  database: Database,
  userId: string,
  input: UpdateAnalyticsPreference,
) => {
  const now = new Date();
  const [saved] = await database
    .insert(userAnalyticsPreference)
    .values({
      userId,
      status: input.status,
      version: ANALYTICS_CONSENT_VERSION,
      decidedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userAnalyticsPreference.userId,
      set: {
        status: input.status,
        version: ANALYTICS_CONSENT_VERSION,
        decidedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return serialize(saved);
};
