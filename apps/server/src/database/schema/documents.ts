import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { project } from "./projects.ts";

export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("document_project_updated_id_idx").on(table.projectId, table.updatedAt, table.id),
  ],
);
