import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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

import { user } from "./auth.ts";

export const aiGenerationType = pgEnum("ai_generation_type", [
  "foundation_draft",
  "selection_generation",
  "collection_generation",
  "reference_resolution",
  "material_improvement",
]);

export const aiGenerationOrigin = pgEnum("ai_generation_origin", [
  "internal",
  "document_selection",
  "document",
  "collection",
  "material",
]);

export const aiGenerationStatus = pgEnum("ai_generation_status", [
  "running",
  "succeeded",
  "failed",
]);

export const aiGeneration = pgTable(
  "ai_generation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: aiGenerationType("type").notNull(),
    origin: aiGenerationOrigin("origin").notNull(),
    status: aiGenerationStatus("status").default("running").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    promptVersion: text("prompt_version").notNull(),
    provider: text("provider").notNull(),
    requestedModel: text("requested_model").notNull(),
    effectiveModel: text("effective_model"),
    providerRequestId: text("provider_request_id"),
    sourceIds: jsonb("source_ids")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    contextFingerprint: text("context_fingerprint").notNull(),
    requestedItems: integer("requested_items").notNull(),
    validItems: integer("valid_items").default(0).notNull(),
    approvedItems: integer("approved_items").default(0).notNull(),
    estimatedCredits: integer("estimated_credits").default(0).notNull(),
    reservedCredits: integer("reserved_credits").default(0).notNull(),
    consumedCredits: integer("consumed_credits").default(0).notNull(),
    regenerationOfId: text("regeneration_of_id").references((): AnyPgColumn => aiGeneration.id, {
      onDelete: "restrict",
    }),
    inputTokens: integer("input_tokens"),
    cachedInputTokens: integer("cached_input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    estimatedCostMicroUsd: bigint("estimated_cost_micro_usd", { mode: "number" }),
    latencyMs: integer("latency_ms"),
    attempts: integer("attempts").default(0).notNull(),
    errorCode: text("error_code"),
    result: jsonb("result").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("ai_generation_user_idempotency_idx").on(table.userId, table.idempotencyKey),
    index("ai_generation_user_created_idx").on(table.userId, table.createdAt, table.id),
    index("ai_generation_user_status_created_idx").on(table.userId, table.status, table.createdAt),
    index("ai_generation_expiry_idx").on(table.expiresAt),
    check("ai_generation_requested_items_check", sql`${table.requestedItems} > 0`),
    check(
      "ai_generation_item_counts_check",
      sql`${table.validItems} >= 0 and ${table.approvedItems} >= 0 and ${table.approvedItems} <= ${table.validItems}`,
    ),
    check("ai_generation_attempts_check", sql`${table.attempts} >= 0`),
    check(
      "ai_generation_credit_counts_check",
      sql`${table.estimatedCredits} >= 0 and ${table.reservedCredits} >= 0 and ${table.consumedCredits} >= 0 and ${table.consumedCredits} <= ${table.estimatedCredits}`,
    ),
    index("ai_generation_regeneration_idx").on(table.regenerationOfId, table.status),
  ],
);
