import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.ts";

/**
 * The person's daily goal: practices per day, what counts, and the study days (bit 0 = Monday).
 * One row per day it changed: a change applies from that day on, past days keep their goal.
 */
export const userStudyGoal = pgTable(
  "user_study_goal",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    counts: text("counts", { enum: ["both", "flashcards", "quizzes"] })
      .default("both")
      .notNull(),
    practices: integer("practices").default(2).notNull(),
    days: integer("days").default(127).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.effectiveFrom] }),
    check(
      "user_study_goal_counts_check",
      sql`${table.counts} in ('both', 'flashcards', 'quizzes')`,
    ),
    check("user_study_goal_practices_check", sql`${table.practices} between 1 and 10`),
    check("user_study_goal_days_check", sql`${table.days} between 1 and 127`),
  ],
);

/** Each level the stone reached, once: the level never drops, even if items are deleted. */
export const userStoneLevel = pgTable(
  "user_stone_level",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    reachedAt: timestamp("reached_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.level] }),
    check("user_stone_level_check", sql`${table.level} between 2 and 5`),
  ],
);
