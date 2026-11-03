import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { ANALYTICS_CONSENT_VERSION } from "@lazuli/shared";
import type { Database } from "../database/client.ts";
import { analyticsConsentEvent } from "../database/schema/legal.ts";
import { updateAnalyticsPreference } from "./analytics-preferences.ts";

describe("analytics consent history", () => {
  it.each([false, true])(
    "records an event only when the atomic upsert changes the decision: %s",
    async (changed) => {
      const saved = {
        userId: "owner",
        status: "granted",
        version: ANALYTICS_CONSENT_VERSION,
        decidedAt: new Date("2026-10-01T00:00:00Z"),
        updatedAt: new Date("2026-10-01T00:00:00Z"),
      };
      const eventValues = vi.fn().mockResolvedValue(undefined);
      const conflict = vi.fn().mockReturnValue({ returning: async () => (changed ? [saved] : []) });
      const findFirst = vi.fn().mockResolvedValue(saved);
      const tx = {
        insert: (table: unknown) =>
          table === analyticsConsentEvent
            ? { values: eventValues }
            : { values: () => ({ onConflictDoUpdate: conflict }) },
        query: { userAnalyticsPreference: { findFirst } },
      };
      const database = {
        transaction: (operation: (value: typeof tx) => unknown) => operation(tx),
      } as unknown as Database;
      const result = await updateAnalyticsPreference(database, "owner", { status: "granted" });
      expect(result).toEqual({
        status: "granted",
        version: ANALYTICS_CONSENT_VERSION,
        decidedAt: saved.decidedAt.toISOString(),
      });
      expect(eventValues).toHaveBeenCalledTimes(Number(changed));
      if (changed)
        expect(eventValues).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "owner",
            status: "granted",
            version: ANALYTICS_CONSENT_VERSION,
          }),
        );
      else expect(findFirst).toHaveBeenCalledOnce();
      const condition = new PgDialect().sqlToQuery(conflict.mock.calls[0]![0].setWhere);
      expect(condition.sql).toContain('"user_analytics_preference"."status" <>');
      expect(condition.sql).toContain('"user_analytics_preference"."version" <>');
      expect(condition.params).toEqual(["granted", ANALYTICS_CONSENT_VERSION]);
    },
  );
});
