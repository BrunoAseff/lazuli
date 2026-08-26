CREATE TABLE "quiz_attempt_asset" (
	"attempt_id" text NOT NULL,
	"asset_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt_item" (
	"id" text PRIMARY KEY NOT NULL,
	"attempt_id" text NOT NULL,
	"question_id" text,
	"position" integer NOT NULL,
	"question" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"correct_option_id" text NOT NULL,
	"selected_option_id" text,
	"is_correct" boolean,
	"answered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempt_item_position_check" CHECK ("quiz_attempt_item"."position" >= 0),
	CONSTRAINT "quiz_attempt_item_answer_check" CHECK (("quiz_attempt_item"."selected_option_id" is null and "quiz_attempt_item"."answered_at" is null) or ("quiz_attempt_item"."selected_option_id" is not null and "quiz_attempt_item"."answered_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "asset" DROP CONSTRAINT "asset_target_check";--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "quiz_question_id" text;--> statement-breakpoint
ALTER TABLE "quiz_question" ADD COLUMN "content_schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempt_asset" ADD CONSTRAINT "quiz_attempt_asset_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_asset" ADD CONSTRAINT "quiz_attempt_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_item" ADD CONSTRAINT "quiz_attempt_item_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_item" ADD CONSTRAINT "quiz_attempt_item_question_id_quiz_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_question"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempt_asset_unique_idx" ON "quiz_attempt_asset" USING btree ("attempt_id","asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempt_item_attempt_position_idx" ON "quiz_attempt_item" USING btree ("attempt_id","position");--> statement-breakpoint
CREATE INDEX "quiz_attempt_item_attempt_answered_idx" ON "quiz_attempt_item" USING btree ("attempt_id","answered_at");--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_quiz_question_id_quiz_question_id_fk" FOREIGN KEY ("quiz_question_id") REFERENCES "public"."quiz_question"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_quiz_question_idx" ON "asset" USING btree ("quiz_question_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempt_one_active_idx" ON "quiz_attempt" USING btree ("user_id","collection_id") WHERE "quiz_attempt"."status" = 'active';--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_target_check" CHECK ((
        ("asset"."project_id" is null and "asset"."document_id" is null and "asset"."flashcard_id" is null and "asset"."quiz_question_id" is null)
        or ("asset"."project_id" is not null and "asset"."document_id" is not null and "asset"."flashcard_id" is null and "asset"."quiz_question_id" is null)
        or ("asset"."project_id" is null and "asset"."document_id" is null and "asset"."flashcard_id" is not null and "asset"."quiz_question_id" is null)
        or ("asset"."project_id" is null and "asset"."document_id" is null and "asset"."flashcard_id" is null and "asset"."quiz_question_id" is not null)
      ));--> statement-breakpoint
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_schema_version_check" CHECK ("quiz_question"."content_schema_version" > 0);