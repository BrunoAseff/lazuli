ALTER TABLE "project" ADD COLUMN "cover_source_asset_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "cover_crop_x" double precision;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "cover_crop_y" double precision;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "cover_crop_zoom" double precision;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_cover_source_asset_id_asset_id_fk" FOREIGN KEY ("cover_source_asset_id") REFERENCES "public"."asset"("id") ON DELETE set null ON UPDATE no action;