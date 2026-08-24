CREATE TYPE "public"."flashcard_rating" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TABLE "flashcard" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"question" jsonb NOT NULL,
	"answer" jsonb NOT NULL,
	"content_schema_version" integer DEFAULT 1 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcard_collection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcard_review" (
	"id" text PRIMARY KEY NOT NULL,
	"flashcard_id" text NOT NULL,
	"rating" "flashcard_rating" NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_due_at" timestamp with time zone NOT NULL,
	"next_due_at" timestamp with time zone NOT NULL,
	CONSTRAINT "flashcard_review_due_order_check" CHECK ("flashcard_review"."next_due_at" >= "flashcard_review"."reviewed_at")
);
--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_collection_id_flashcard_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."flashcard_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_collection" ADD CONSTRAINT "flashcard_collection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_collection" ADD CONSTRAINT "flashcard_collection_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD CONSTRAINT "flashcard_review_flashcard_id_flashcard_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flashcard_collection_archived_created_idx" ON "flashcard" USING btree ("collection_id","archived_at","created_at","id");--> statement-breakpoint
CREATE INDEX "flashcard_collection_archived_due_idx" ON "flashcard" USING btree ("collection_id","archived_at","due_at");--> statement-breakpoint
CREATE INDEX "flashcard_collection_user_status_created_idx" ON "flashcard_collection" USING btree ("user_id","archived_at","created_at","id");--> statement-breakpoint
CREATE INDEX "flashcard_collection_user_project_status_created_idx" ON "flashcard_collection" USING btree ("user_id","project_id","archived_at","created_at","id");--> statement-breakpoint
CREATE INDEX "flashcard_review_card_reviewed_idx" ON "flashcard_review" USING btree ("flashcard_id","reviewed_at","id");--> statement-breakpoint
CREATE INDEX "flashcard_review_reviewed_card_idx" ON "flashcard_review" USING btree ("reviewed_at","flashcard_id");