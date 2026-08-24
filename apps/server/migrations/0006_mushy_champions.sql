ALTER TABLE "asset" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "document_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "flashcard_id" text;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "question_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcard" ADD COLUMN "answer_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_flashcard_id_flashcard_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_flashcard_idx" ON "asset" USING btree ("flashcard_id","created_at");--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_target_check" CHECK ((
        ("asset"."project_id" is null and "asset"."document_id" is null and "asset"."flashcard_id" is null)
        or ("asset"."project_id" is not null and "asset"."document_id" is not null and "asset"."flashcard_id" is null)
        or ("asset"."project_id" is null and "asset"."document_id" is null and "asset"."flashcard_id" is not null)
      ));