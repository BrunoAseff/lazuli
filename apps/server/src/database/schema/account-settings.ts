import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AccountExportCategory } from "@lazuli/shared";

import { user } from "./auth.ts";

export const accountExportStatus = pgEnum("account_export_status", [
  "queued",
  "processing",
  "ready",
  "failed",
  "expired",
  "revoked",
]);

export const userInterfacePreference = pgTable(
  "user_interface_preference",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    theme: text("theme", { enum: ["system", "light", "dark"] })
      .default("system")
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("user_interface_theme_check", sql`${table.theme} in ('system', 'light', 'dark')`),
  ],
);

export const userStudyPreference = pgTable(
  "user_study_preference",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    desiredRetention: integer("desired_retention").default(90).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "user_study_preference_retention_check",
      sql`${table.desiredRetention} between 80 and 95`,
    ),
  ],
);

export const accountExport = pgTable(
  "account_export",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categories: jsonb("categories").$type<AccountExportCategory[]>().notNull(),
    status: accountExportStatus("status").default("queued").notNull(),
    objectKey: text("object_key"),
    byteSize: bigint("byte_size", { mode: "number" }),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    leaseOwner: text("lease_owner"),
    leasedUntil: timestamp("leased_until", { withTimezone: true }),
    errorCode: text("error_code"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("account_export_claim_idx").on(table.status, table.availableAt, table.createdAt),
    index("account_export_user_created_idx").on(table.userId, table.createdAt, table.id),
    index("account_export_expiry_idx").on(table.status, table.expiresAt),
    uniqueIndex("account_export_one_active_per_user_idx")
      .on(table.userId)
      .where(sql`${table.status} in ('queued', 'processing')`),
    check("account_export_attempts_check", sql`${table.attempts} >= 0`),
  ],
);
