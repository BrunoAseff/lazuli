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

export const aiCreditLedger = pgTable(
  "ai_credit_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    generationId: text("generation_id").references(() => aiGeneration.id, {
      onDelete: "restrict",
    }),
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
