CREATE TABLE "storage_object_deletion" (
	"object_key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "attached_at" timestamp with time zone;--> statement-breakpoint
UPDATE "asset" SET "attached_at" = "created_at" WHERE "attached_at" IS NULL;--> statement-breakpoint
CREATE INDEX "storage_object_deletion_available_idx" ON "storage_object_deletion" USING btree ("available_at","created_at");--> statement-breakpoint
CREATE INDEX "asset_unattached_idx" ON "asset" USING btree ("attached_at","created_at");--> statement-breakpoint
CREATE INDEX "document_import_user_created_idx" ON "document_import" USING btree ("user_id","created_at");
