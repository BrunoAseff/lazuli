CREATE TYPE "public"."quiz_attempt_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "quiz_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"status" "quiz_attempt_status" DEFAULT 'active' NOT NULL,
	"answered_questions" integer DEFAULT 0 NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"total_questions" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempt_total_check" CHECK ("quiz_attempt"."total_questions" >= 0),
	CONSTRAINT "quiz_attempt_answered_check" CHECK ("quiz_attempt"."answered_questions" >= 0 and "quiz_attempt"."answered_questions" <= "quiz_attempt"."total_questions"),
	CONSTRAINT "quiz_attempt_correct_check" CHECK ("quiz_attempt"."correct_answers" >= 0 and "quiz_attempt"."correct_answers" <= "quiz_attempt"."answered_questions"),
	CONSTRAINT "quiz_attempt_completion_check" CHECK (("quiz_attempt"."status" = 'completed' and "quiz_attempt"."completed_at" is not null and "quiz_attempt"."total_questions" > 0 and "quiz_attempt"."answered_questions" = "quiz_attempt"."total_questions") or ("quiz_attempt"."status" <> 'completed' and "quiz_attempt"."completed_at" is null))
);
--> statement-breakpoint
CREATE TABLE "quiz_collection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_option" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_option_position_check" CHECK ("quiz_option"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_question" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_question_position_check" CHECK ("quiz_question"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_collection_id_quiz_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."quiz_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_collection" ADD CONSTRAINT "quiz_collection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_collection" ADD CONSTRAINT "quiz_collection_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_option" ADD CONSTRAINT "quiz_option_question_id_quiz_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_collection_id_quiz_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."quiz_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_attempt_collection_status_completed_idx" ON "quiz_attempt" USING btree ("collection_id","status","completed_at","id");--> statement-breakpoint
CREATE INDEX "quiz_attempt_user_status_activity_idx" ON "quiz_attempt" USING btree ("user_id","status","last_activity_at");--> statement-breakpoint
CREATE INDEX "quiz_collection_user_status_created_idx" ON "quiz_collection" USING btree ("user_id","archived_at","created_at","id");--> statement-breakpoint
CREATE INDEX "quiz_collection_user_project_status_created_idx" ON "quiz_collection" USING btree ("user_id","project_id","archived_at","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_option_question_position_idx" ON "quiz_option" USING btree ("question_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_option_one_correct_idx" ON "quiz_option" USING btree ("question_id") WHERE "quiz_option"."is_correct" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_question_collection_position_idx" ON "quiz_question" USING btree ("collection_id","position");--> statement-breakpoint
CREATE INDEX "quiz_question_collection_archived_created_idx" ON "quiz_question" USING btree ("collection_id","archived_at","created_at","id");