import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { aiGeneration } from "./ai.ts";
import { user } from "./auth.ts";

export const aiCreditEventType = pgEnum("ai_credit_event_type", [
  "grant",
  "reserve",
  "consume",
  "release",
  "adjustment",
]);

export const aiCreditActorType = pgEnum("ai_credit_actor_type", ["system", "user", "admin"]);
export const aiCreditBucketOrigin = pgEnum("ai_credit_bucket_origin", [
  "monthly",
  "admin_bonus",
  "legacy",
  "purchase",
]);

export const aiCreditAccount = pgTable(
  "ai_credit_account",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    availableBalance: integer("available_balance").default(0).notNull(),
    reservedBalance: integer("reserved_balance").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("ai_credit_account_available_check", sql`${table.availableBalance} >= 0`),
    check("ai_credit_account_reserved_check", sql`${table.reservedBalance} >= 0`),
  ],
);

export const aiCreditBucket = pgTable(
  "ai_credit_bucket",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    origin: aiCreditBucketOrigin("origin").notNull(),
    plan: text("plan"),
    totalCredits: integer("total_credits").notNull(),
    remainingCredits: integer("remaining_credits").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    sourceId: text("source_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ai_credit_bucket_user_idempotency_idx").on(table.userId, table.idempotencyKey),
    index("ai_credit_bucket_spend_idx").on(
      table.userId,
      table.expiresAt,
      table.createdAt,
      table.id,
    ),
    check(
      "ai_credit_bucket_amounts_check",
      sql`${table.totalCredits} >= 0 and ${table.remainingCredits} >= 0 and ${table.remainingCredits} <= ${table.totalCredits}`,
    ),
  ],
);

export const aiCreditLedger = pgTable(
  "ai_credit_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    generationId: text("generation_id").references(() => aiGeneration.id, {
      onDelete: "no action",
    }),
    bucketId: text("bucket_id").references(() => aiCreditBucket.id, { onDelete: "set null" }),
    type: aiCreditEventType("type").notNull(),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    actorType: aiCreditActorType("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ai_credit_ledger_user_idempotency_idx").on(table.userId, table.idempotencyKey),
    index("ai_credit_ledger_user_created_idx").on(table.userId, table.createdAt, table.id),
    index("ai_credit_ledger_generation_idx").on(table.generationId),
    check(
      "ai_credit_ledger_amount_check",
      sql`${table.amount} <> 0 and (${table.type} = 'adjustment' or ${table.amount} > 0)`,
    ),
  ],
);

export const aiCreditReservationAllocation = pgTable(
  "ai_credit_reservation_allocation",
  {
    generationId: text("generation_id")
      .notNull()
      .references(() => aiGeneration.id, { onDelete: "cascade" }),
    bucketId: text("bucket_id")
      .notNull()
      .references(() => aiCreditBucket.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ai_credit_reservation_allocation_pk").on(table.generationId, table.bucketId),
    index("ai_credit_reservation_bucket_idx").on(table.bucketId),
    check("ai_credit_reservation_amount_check", sql`${table.amount} > 0`),
  ],
);
