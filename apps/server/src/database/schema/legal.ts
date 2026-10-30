import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

export const legalAcceptance = pgTable(
  "legal_acceptance",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    termsVersion: text("terms_version").notNull(),
    privacyVersion: text("privacy_version").notNull(),
    termsHash: text("terms_hash").notNull(),
    privacyHash: text("privacy_hash").notNull(),
    actionLabel: text("action_label").notNull(),
    source: text("source", { enum: ["email-registration", "account-gate"] }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("legal_acceptance_user_edition_idx").on(
      table.userId,
      table.termsHash,
      table.privacyHash,
    ),
  ],
);

export const analyticsConsentEvent = pgTable(
  "analytics_consent_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["granted", "denied"] }).notNull(),
    version: integer("version").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("analytics_consent_event_user_idx").on(table.userId, table.decidedAt)],
);
