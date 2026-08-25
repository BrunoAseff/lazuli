CREATE TYPE "public"."flashcard_practice_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."flashcard_srs_state" AS ENUM('new', 'learning', 'review', 'relearning');--> statement-breakpoint
CREATE TABLE "flashcard_practice_item" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"flashcard_id" text NOT NULL,
	"position" integer NOT NULL,
	"review_id" text,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "flashcard_practice_item_review_id_unique" UNIQUE("review_id"),
	CONSTRAINT "flashcard_practice_item_position_check" CHECK ("flashcard_practice_item"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "flashcard_practice_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"status" "flashcard_practice_status" DEFAULT 'active' NOT NULL,
	"total_cards" integer NOT NULL,
	"reviewed_cards" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flashcard_practice_progress_check" CHECK ("flashcard_practice_session"."total_cards" >= 0 and "flashcard_practice_session"."reviewed_cards" >= 0 and "flashcard_practice_session"."reviewed_cards" <= "flashcard_practice_session"."total_cards")
);
--> statement-breakpoint
DROP INDEX "flashcard_collection_archived_due_idx";--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "srs_state" "flashcard_srs_state" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "stability" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "difficulty" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "elapsed_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "scheduled_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "learning_steps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "reps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "lapses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "scheduler_version" text DEFAULT 'ts-fsrs@5.4.1' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "practice_item_id" text;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "previous_state" "flashcard_srs_state";--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "next_state" "flashcard_srs_state";--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "stability" double precision;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "difficulty" double precision;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "elapsed_days" integer;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "scheduled_days" integer;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "learning_steps" integer;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD COLUMN "scheduler_version" text;--> statement-breakpoint
INSERT INTO "flashcard_practice_session" ("id", "user_id", "collection_id", "status", "total_cards", "reviewed_cards", "started_at", "last_activity_at", "finished_at", "created_at")
SELECT 'legacy-session-' || r."id", c."user_id", f."collection_id", 'completed', 1, 1, r."reviewed_at", r."reviewed_at", r."reviewed_at", r."reviewed_at"
FROM "flashcard_review" r
INNER JOIN "flashcard" f ON f."id" = r."flashcard_id"
INNER JOIN "flashcard_collection" c ON c."id" = f."collection_id";--> statement-breakpoint
INSERT INTO "flashcard_practice_item" ("id", "session_id", "flashcard_id", "position", "review_id", "reviewed_at")
SELECT 'legacy-item-' || r."id", 'legacy-session-' || r."id", r."flashcard_id", 0, r."id", r."reviewed_at"
FROM "flashcard_review" r;--> statement-breakpoint
UPDATE "flashcard_review"
SET "session_id" = 'legacy-session-' || "id",
    "practice_item_id" = 'legacy-item-' || "id",
    "previous_state" = 'review',
    "next_state" = 'review',
    "stability" = 0,
    "difficulty" = 0,
    "elapsed_days" = greatest(0, floor(extract(epoch from ("reviewed_at" - "previous_due_at")) / 86400)::integer),
    "scheduled_days" = greatest(0, ceil(extract(epoch from ("next_due_at" - "reviewed_at")) / 86400)::integer),
    "learning_steps" = 0,
    "scheduler_version" = 'legacy-unreconstructable';--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "practice_item_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "previous_state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "next_state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "stability" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "difficulty" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "elapsed_days" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "scheduled_days" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "learning_steps" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_review" ALTER COLUMN "scheduler_version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard_practice_item" ADD CONSTRAINT "flashcard_practice_item_session_id_flashcard_practice_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."flashcard_practice_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_practice_item" ADD CONSTRAINT "flashcard_practice_item_flashcard_id_flashcard_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_practice_session" ADD CONSTRAINT "flashcard_practice_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_practice_session" ADD CONSTRAINT "flashcard_practice_session_collection_id_flashcard_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."flashcard_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "flashcard_practice_item_card_idx" ON "flashcard_practice_item" USING btree ("session_id","flashcard_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flashcard_practice_item_position_idx" ON "flashcard_practice_item" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "flashcard_practice_item_pending_idx" ON "flashcard_practice_item" USING btree ("session_id","reviewed_at","position");--> statement-breakpoint
CREATE UNIQUE INDEX "flashcard_practice_one_active_collection_idx" ON "flashcard_practice_session" USING btree ("user_id","collection_id") WHERE "flashcard_practice_session"."status" = 'active';--> statement-breakpoint
CREATE INDEX "flashcard_practice_user_status_activity_idx" ON "flashcard_practice_session" USING btree ("user_id","status","last_activity_at");--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD CONSTRAINT "flashcard_review_session_id_flashcard_practice_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."flashcard_practice_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD CONSTRAINT "flashcard_review_practice_item_id_flashcard_practice_item_id_fk" FOREIGN KEY ("practice_item_id") REFERENCES "public"."flashcard_practice_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "flashcard_review_practice_item_idx" ON "flashcard_review" USING btree ("practice_item_id");--> statement-breakpoint
CREATE INDEX "flashcard_review_session_reviewed_idx" ON "flashcard_review" USING btree ("session_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "flashcard_collection_archived_due_idx" ON "flashcard" USING btree ("collection_id","archived_at","due_at","id");--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_stability_check" CHECK ("flashcard"."stability" >= 0);--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_difficulty_check" CHECK ("flashcard"."difficulty" >= 0);--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_elapsed_days_check" CHECK ("flashcard"."elapsed_days" >= 0);--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_scheduled_days_check" CHECK ("flashcard"."scheduled_days" >= 0);--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_learning_steps_check" CHECK ("flashcard"."learning_steps" >= 0);--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_reps_check" CHECK ("flashcard"."reps" >= 0);--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_lapses_check" CHECK ("flashcard"."lapses" >= 0);--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD CONSTRAINT "flashcard_review_stability_check" CHECK ("flashcard_review"."stability" >= 0);--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD CONSTRAINT "flashcard_review_difficulty_check" CHECK ("flashcard_review"."difficulty" >= 0);
