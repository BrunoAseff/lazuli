import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.ts";

export const analyticsConsentStatus = pgEnum("analytics_consent_status", ["granted", "denied"]);

export const userAnalyticsPreference = pgTable("user_analytics_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  status: analyticsConsentStatus("status").notNull(),
  version: integer("version").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
