import { pgTable, text, jsonb, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import type { LifecycleEmailPayload, LifecycleEmailKind } from "../../email/lifecycle-email.ts";

export const emailRollout = pgTable("email_rollout", {
  key: text("key").primaryKey(),
  activatedAt: timestamp("activated_at", { withTimezone: true }).defaultNow().notNull(),
});

// No user FK: a deletion confirmation must survive deletion of that user.
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: text("id").primaryKey(),
    deduplicationKey: text("deduplication_key").notNull(),
    userId: text("user_id"),
    recipient: text("recipient"),
    kind: text("kind").$type<LifecycleEmailKind>().notNull(),
    payload: jsonb("payload").$type<LifecycleEmailPayload | Record<string, never>>().notNull(),
    rendered: jsonb("rendered").$type<{ html: string; text: string; subject: string }>(),
    readyWhen: text("ready_when", { enum: ["immediate", "verified", "deleted"] })
      .default("immediate")
      .notNull(),
    afterKey: text("after_key"),
    status: text("status", { enum: ["queued", "processing", "sent", "failed", "requires_review"] })
      .default("queued")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    leaseOwner: text("lease_owner"),
    leasedUntil: timestamp("leased_until", { withTimezone: true }),
    providerId: text("provider_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_outbox_deduplication").on(table.deduplicationKey),
    index("email_outbox_claim").on(table.status, table.availableAt, table.createdAt),
  ],
);
