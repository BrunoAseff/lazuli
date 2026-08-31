import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth.ts";
import { document } from "./documents.ts";
import { flashcard } from "./flashcards.ts";
import { quizQuestion } from "./quizzes.ts";

export const studyMaterialReference = pgTable(
  "study_material_reference",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    anchorId: text("anchor_id"),
    flashcardId: text("flashcard_id").references(() => flashcard.id, { onDelete: "cascade" }),
    quizQuestionId: text("quiz_question_id").references(() => quizQuestion.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "study_material_reference_one_target_check",
      sql`num_nonnulls(${table.flashcardId}, ${table.quizQuestionId}) = 1`,
    ),
    check(
      "study_material_reference_anchor_length_check",
      sql`${table.anchorId} is null or length(${table.anchorId}) between 1 and 128`,
    ),
    index("study_material_reference_document_anchor_idx").on(
      table.documentId,
      table.anchorId,
      table.createdAt,
      table.id,
    ),
    index("study_material_reference_user_created_idx").on(table.userId, table.createdAt, table.id),
    index("study_material_reference_flashcard_idx").on(table.flashcardId, table.createdAt),
    index("study_material_reference_quiz_question_idx").on(table.quizQuestionId, table.createdAt),
    uniqueIndex("study_material_reference_flashcard_source_unique_idx")
      .on(table.flashcardId, table.documentId, table.anchorId)
      .where(sql`${table.flashcardId} is not null and ${table.anchorId} is not null`),
    uniqueIndex("study_material_reference_flashcard_document_unique_idx")
      .on(table.flashcardId, table.documentId)
      .where(sql`${table.flashcardId} is not null and ${table.anchorId} is null`),
    uniqueIndex("study_material_reference_quiz_source_unique_idx")
      .on(table.quizQuestionId, table.documentId, table.anchorId)
      .where(sql`${table.quizQuestionId} is not null and ${table.anchorId} is not null`),
    uniqueIndex("study_material_reference_quiz_document_unique_idx")
      .on(table.quizQuestionId, table.documentId)
      .where(sql`${table.quizQuestionId} is not null and ${table.anchorId} is null`),
  ],
);
