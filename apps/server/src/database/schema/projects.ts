import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.ts";

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    coverKey: text("cover_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("project_user_updated_id_idx").on(table.userId, table.updatedAt, table.id)],
);
