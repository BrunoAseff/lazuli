import { sql } from "drizzle-orm";
import {
  check,
  boolean,
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

export const commercialPlan = pgEnum("commercial_plan", ["basic", "essential", "specialist"]);
export const billingSubscriptionStatus = pgEnum("billing_subscription_status", [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);
export const billingWebhookStatus = pgEnum("billing_webhook_status", [
  "pending",
  "processing",
  "processed",
  "failed",
]);
export const stripeEnvironment = pgEnum("stripe_environment", ["test", "live"]);

export const billingCustomer = pgTable("billing_customer", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  environment: stripeEnvironment("environment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const billingSubscription = pgTable(
  "billing_subscription",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripePriceId: text("stripe_price_id").notNull(),
    environment: stripeEnvironment("environment").notNull(),
    plan: commercialPlan("plan").notNull(),
    status: billingSubscriptionStatus("status").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    accessUntil: timestamp("access_until", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    lastStripeEventId: text("last_stripe_event_id"),
    providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("billing_subscription_status_idx").on(table.status, table.accessUntil)],
);

export const adminPlanGrant = pgTable(
  "admin_plan_grant",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plan: commercialPlan("plan").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    reason: text("reason").notNull(),
    operatorId: text("operator_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("admin_plan_grant_operator_idempotency_idx").on(
      table.operatorId,
      table.idempotencyKey,
    ),
    index("admin_plan_grant_active_idx").on(table.userId, table.revokedAt, table.endsAt),
  ],
);

export const billingWebhookEvent = pgTable("billing_webhook_event", {
  stripeEventId: text("stripe_event_id").primaryKey(),
  type: text("type").notNull(),
  status: billingWebhookStatus("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  providerCreatedAt: timestamp("provider_created_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const commercialMaintenanceLease = pgTable("commercial_maintenance_lease", {
  name: text("name").primaryKey(),
  ownerId: text("owner_id").notNull(),
  leasedUntil: timestamp("leased_until", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const commercialAuditLog = pgTable(
  "commercial_audit_log",
  {
    id: text("id").primaryKey(),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    operatorId: text("operator_id").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    environment: text("environment").notNull(),
    dryRun: boolean("dry_run").default(false).notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("commercial_audit_operator_idempotency_idx").on(
      table.operatorId,
      table.targetUserId,
      table.idempotencyKey,
    ),
    index("commercial_audit_target_created_idx").on(table.targetUserId, table.createdAt),
    check("commercial_audit_reason_check", sql`length(trim(${table.reason})) > 0`),
  ],
);
