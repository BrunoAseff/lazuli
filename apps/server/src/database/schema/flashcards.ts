import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth.ts";
import { project } from "./projects.ts";

export const flashcardRating = pgEnum("flashcard_rating", ["again", "hard", "good", "easy"]);

export const flashcardCollection = pgTable(
  "flashcard_collection",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => project.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("flashcard_collection_user_status_created_idx").on(
      table.userId,
      table.archivedAt,
      table.createdAt,
      table.id,
    ),
    index("flashcard_collection_user_project_status_created_idx").on(
      table.userId,
      table.projectId,
      table.archivedAt,
      table.createdAt,
      table.id,
    ),
  ],
);

export const flashcard = pgTable(
  "flashcard",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => flashcardCollection.id, { onDelete: "cascade" }),
    question: jsonb("question").$type<unknown[]>().notNull(),
    answer: jsonb("answer").$type<unknown[]>().notNull(),
    contentSchemaVersion: integer("content_schema_version").default(1).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).defaultNow().notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("flashcard_collection_archived_created_idx").on(
      table.collectionId,
      table.archivedAt,
      table.createdAt,
      table.id,
    ),
    index("flashcard_collection_archived_due_idx").on(
      table.collectionId,
      table.archivedAt,
      table.dueAt,
    ),
  ],
);

export const flashcardReview = pgTable(
  "flashcard_review",
  {
    id: text("id").primaryKey(),
    flashcardId: text("flashcard_id")
      .notNull()
      .references(() => flashcard.id, { onDelete: "cascade" }),
    rating: flashcardRating("rating").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
    previousDueAt: timestamp("previous_due_at", { withTimezone: true }).notNull(),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("flashcard_review_card_reviewed_idx").on(table.flashcardId, table.reviewedAt, table.id),
    index("flashcard_review_reviewed_card_idx").on(table.reviewedAt, table.flashcardId),
    check("flashcard_review_due_order_check", sql`${table.nextDueAt} >= ${table.reviewedAt}`),
  ],
);
