import { sql } from "drizzle-orm";
import {
  boolean,
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
import { project } from "./projects.ts";

export const quizAttemptStatus = pgEnum("quiz_attempt_status", [
  "active",
  "completed",
  "abandoned",
]);

export const quizCollection = pgTable(
  "quiz_collection",
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
    index("quiz_collection_user_status_created_idx").on(
      table.userId,
      table.archivedAt,
      table.createdAt,
      table.id,
    ),
    index("quiz_collection_user_project_status_created_idx").on(
      table.userId,
      table.projectId,
      table.archivedAt,
      table.createdAt,
      table.id,
    ),
  ],
);

export const quizQuestion = pgTable(
  "quiz_question",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => quizCollection.id, { onDelete: "cascade" }),
    content: jsonb("content").$type<unknown[]>().notNull(),
    contentText: text("content_text").default("").notNull(),
    contentSchemaVersion: integer("content_schema_version").default(1).notNull(),
    position: integer("position").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("quiz_question_collection_position_idx").on(table.collectionId, table.position),
    index("quiz_question_collection_archived_created_idx").on(
      table.collectionId,
      table.archivedAt,
      table.createdAt,
      table.id,
    ),
    check("quiz_question_position_check", sql`${table.position} >= 0`),
    check("quiz_question_schema_version_check", sql`${table.contentSchemaVersion} > 0`),
  ],
);

export const quizOption = pgTable(
  "quiz_option",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    position: integer("position").notNull(),
    isCorrect: boolean("is_correct").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("quiz_option_question_position_idx").on(table.questionId, table.position),
    uniqueIndex("quiz_option_one_correct_idx")
      .on(table.questionId)
      .where(sql`${table.isCorrect} = true`),
    check("quiz_option_position_check", sql`${table.position} >= 0`),
  ],
);

export const quizAttempt = pgTable(
  "quiz_attempt",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => quizCollection.id, { onDelete: "cascade" }),
    status: quizAttemptStatus("status").default("active").notNull(),
    answeredQuestions: integer("answered_questions").default(0).notNull(),
    correctAnswers: integer("correct_answers").default(0).notNull(),
    totalQuestions: integer("total_questions").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("quiz_attempt_collection_status_completed_idx").on(
      table.collectionId,
      table.status,
      table.completedAt,
      table.id,
    ),
    index("quiz_attempt_user_status_activity_idx").on(
      table.userId,
      table.status,
      table.lastActivityAt,
    ),
    uniqueIndex("quiz_attempt_one_active_idx")
      .on(table.userId, table.collectionId)
      .where(sql`${table.status} = 'active'`),
    check("quiz_attempt_total_check", sql`${table.totalQuestions} >= 0`),
    check(
      "quiz_attempt_answered_check",
      sql`${table.answeredQuestions} >= 0 and ${table.answeredQuestions} <= ${table.totalQuestions}`,
    ),
    check(
      "quiz_attempt_correct_check",
      sql`${table.correctAnswers} >= 0 and ${table.correctAnswers} <= ${table.answeredQuestions}`,
    ),
    check(
      "quiz_attempt_completion_check",
      sql`(${table.status} = 'completed' and ${table.completedAt} is not null and ${table.totalQuestions} > 0 and ${table.answeredQuestions} = ${table.totalQuestions}) or (${table.status} <> 'completed' and ${table.completedAt} is null)`,
    ),
  ],
);

export type QuizAttemptOptionSnapshot = { id: string; text: string; position: number };

export const quizAttemptItem = pgTable(
  "quiz_attempt_item",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => quizAttempt.id, { onDelete: "cascade" }),
    questionId: text("question_id").references(() => quizQuestion.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    question: jsonb("question").$type<unknown[]>().notNull(),
    options: jsonb("options").$type<QuizAttemptOptionSnapshot[]>().notNull(),
    correctOptionId: text("correct_option_id").notNull(),
    selectedOptionId: text("selected_option_id"),
    isCorrect: boolean("is_correct"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("quiz_attempt_item_attempt_position_idx").on(table.attemptId, table.position),
    index("quiz_attempt_item_attempt_answered_idx").on(table.attemptId, table.answeredAt),
    check("quiz_attempt_item_position_check", sql`${table.position} >= 0`),
    check(
      "quiz_attempt_item_answer_check",
      sql`(${table.selectedOptionId} is null and ${table.answeredAt} is null) or (${table.selectedOptionId} is not null and ${table.answeredAt} is not null)`,
    ),
  ],
);
