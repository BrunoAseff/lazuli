import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.ts";

export const userDashboardOnboarding = pgTable("user_dashboard_onboarding", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull(),
});
