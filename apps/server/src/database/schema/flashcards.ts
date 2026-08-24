import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
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
import { project } from "./projects.ts";

export const flashcardRating = pgEnum("flashcard_rating", ["again", "hard", "good", "easy"]);
export const flashcardSrsState = pgEnum("flashcard_srs_state", [
  "new",
  "learning",
  "review",
  "relearning",
]);
export const flashcardPracticeStatus = pgEnum("flashcard_practice_status", [
  "active",
  "completed",
  "abandoned",
]);

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
    questionText: text("question_text").default("").notNull(),
    answerText: text("answer_text").default("").notNull(),
    contentSchemaVersion: integer("content_schema_version").default(1).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).defaultNow().notNull(),
    srsState: flashcardSrsState("srs_state").default("new").notNull(),
    stability: doublePrecision("stability").default(0).notNull(),
    difficulty: doublePrecision("difficulty").default(0).notNull(),
    elapsedDays: integer("elapsed_days").default(0).notNull(),
    scheduledDays: integer("scheduled_days").default(0).notNull(),
    learningSteps: integer("learning_steps").default(0).notNull(),
    reps: integer("reps").default(0).notNull(),
    lapses: integer("lapses").default(0).notNull(),
    schedulerVersion: text("scheduler_version").default("ts-fsrs@5.4.1").notNull(),
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
      table.id,
    ),
    check("flashcard_stability_check", sql`${table.stability} >= 0`),
    check("flashcard_difficulty_check", sql`${table.difficulty} >= 0`),
    check("flashcard_elapsed_days_check", sql`${table.elapsedDays} >= 0`),
    check("flashcard_scheduled_days_check", sql`${table.scheduledDays} >= 0`),
    check("flashcard_learning_steps_check", sql`${table.learningSteps} >= 0`),
    check("flashcard_reps_check", sql`${table.reps} >= 0`),
    check("flashcard_lapses_check", sql`${table.lapses} >= 0`),
  ],
);

export const flashcardPracticeSession = pgTable(
  "flashcard_practice_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => flashcardCollection.id, { onDelete: "cascade" }),
    status: flashcardPracticeStatus("status").default("active").notNull(),
    totalCards: integer("total_cards").notNull(),
    reviewedCards: integer("reviewed_cards").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("flashcard_practice_one_active_collection_idx")
      .on(table.userId, table.collectionId)
      .where(sql`${table.status} = 'active'`),
    index("flashcard_practice_user_status_activity_idx").on(
      table.userId,
      table.status,
      table.lastActivityAt,
    ),
    check(
      "flashcard_practice_progress_check",
      sql`${table.totalCards} >= 0 and ${table.reviewedCards} >= 0 and ${table.reviewedCards} <= ${table.totalCards}`,
    ),
  ],
);

export const flashcardPracticeItem = pgTable(
  "flashcard_practice_item",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => flashcardPracticeSession.id, { onDelete: "cascade" }),
    flashcardId: text("flashcard_id")
      .notNull()
      .references(() => flashcard.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    reviewId: text("review_id").unique(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("flashcard_practice_item_card_idx").on(table.sessionId, table.flashcardId),
    uniqueIndex("flashcard_practice_item_position_idx").on(table.sessionId, table.position),
    index("flashcard_practice_item_pending_idx").on(
      table.sessionId,
      table.reviewedAt,
      table.position,
    ),
    check("flashcard_practice_item_position_check", sql`${table.position} >= 0`),
  ],
);

export const flashcardReview = pgTable(
  "flashcard_review",
  {
    id: text("id").primaryKey(),
    flashcardId: text("flashcard_id")
      .notNull()
      .references(() => flashcard.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => flashcardPracticeSession.id, { onDelete: "cascade" }),
    practiceItemId: text("practice_item_id")
      .notNull()
      .references(() => flashcardPracticeItem.id, { onDelete: "cascade" }),
    rating: flashcardRating("rating").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
    previousDueAt: timestamp("previous_due_at", { withTimezone: true }).notNull(),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(),
    previousState: flashcardSrsState("previous_state").notNull(),
    nextState: flashcardSrsState("next_state").notNull(),
    stability: doublePrecision("stability").notNull(),
    difficulty: doublePrecision("difficulty").notNull(),
    elapsedDays: integer("elapsed_days").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    learningSteps: integer("learning_steps").notNull(),
    schedulerVersion: text("scheduler_version").notNull(),
  },
  (table) => [
    index("flashcard_review_card_reviewed_idx").on(table.flashcardId, table.reviewedAt, table.id),
    index("flashcard_review_reviewed_card_idx").on(table.reviewedAt, table.flashcardId),
    index("flashcard_review_practice_item_idx").on(table.practiceItemId),
    index("flashcard_review_session_reviewed_idx").on(table.sessionId, table.reviewedAt),
    check("flashcard_review_due_order_check", sql`${table.nextDueAt} >= ${table.reviewedAt}`),
    check("flashcard_review_stability_check", sql`${table.stability} >= 0`),
    check("flashcard_review_difficulty_check", sql`${table.difficulty} >= 0`),
  ],
);
