ALTER TABLE "asset" DROP CONSTRAINT "asset_target_check";--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "cover_asset_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "cover_thumbnail_asset_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_cover_asset_id_asset_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_cover_thumbnail_asset_id_asset_id_fk" FOREIGN KEY ("cover_thumbnail_asset_id") REFERENCES "public"."asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_target_check" CHECK ((
        ("asset"."project_id" is null and "asset"."document_id" is null and "asset"."flashcard_id" is null and "asset"."quiz_question_id" is null)
        or ("asset"."project_id" is not null and "asset"."document_id" is null and "asset"."flashcard_id" is null and "asset"."quiz_question_id" is null)
        or ("asset"."project_id" is not null and "asset"."document_id" is not null and "asset"."flashcard_id" is null and "asset"."quiz_question_id" is null)
        or ("asset"."project_id" is null and "asset"."document_id" is null and "asset"."flashcard_id" is not null and "asset"."quiz_question_id" is null)
        or ("asset"."project_id" is null and "asset"."document_id" is null and "asset"."flashcard_id" is null and "asset"."quiz_question_id" is not null)
      ));