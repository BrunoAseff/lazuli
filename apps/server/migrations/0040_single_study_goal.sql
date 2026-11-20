-- Keep only each person's latest goal before the key becomes one row per person.
DELETE FROM "user_study_goal" g USING "user_study_goal" newer
WHERE newer."user_id" = g."user_id" AND newer."effective_from" > g."effective_from";--> statement-breakpoint
ALTER TABLE "user_study_goal" DROP CONSTRAINT "user_study_goal_user_id_effective_from_pk";--> statement-breakpoint
ALTER TABLE "user_study_goal" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "user_study_goal" DROP COLUMN "effective_from";