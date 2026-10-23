import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, check, uniqueIndex, index } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { project } from "./projects.ts";
import { projectItem } from "./documents.ts";
import { flashcardCollection } from "./flashcards.ts";
import { quizCollection } from "./quizzes.ts";

export const userFavorite = pgTable(
  "user_favorite",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => project.id, { onDelete: "cascade" }),
    documentId: text("document_id").references(() => projectItem.id, { onDelete: "cascade" }),
    flashcardCollectionId: text("flashcard_collection_id").references(
      () => flashcardCollection.id,
      { onDelete: "cascade" },
    ),
    quizCollectionId: text("quiz_collection_id").references(() => quizCollection.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "favorite_single_target",
      sql`num_nonnulls(${table.projectId}, ${table.documentId}, ${table.flashcardCollectionId}, ${table.quizCollectionId}) = 1`,
    ),
    uniqueIndex("favorite_user_project").on(table.userId, table.projectId),
    uniqueIndex("favorite_user_document").on(table.userId, table.documentId),
    uniqueIndex("favorite_user_flashcards").on(table.userId, table.flashcardCollectionId),
    uniqueIndex("favorite_user_quizzes").on(table.userId, table.quizCollectionId),
    index("favorite_user_created").on(table.userId, table.createdAt, table.id),
  ],
);
