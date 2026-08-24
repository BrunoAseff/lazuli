CREATE TYPE "public"."document_import_phase" AS ENUM('validating', 'extracting', 'converting', 'finalizing');--> statement-breakpoint
CREATE TYPE "public"."document_import_status" AS ENUM('uploading', 'queued', 'processing', 'finalizing', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "document_import" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"parent_id" text,
	"document_id" text NOT NULL,
	"original_name" text NOT NULL,
	"declared_mime_type" text NOT NULL,
	"detected_mime_type" text,
	"input_byte_size" bigint NOT NULL,
	"input_object_key" text,
	"status" "document_import_status" DEFAULT 'uploading' NOT NULL,
	"phase" "document_import_phase",
	"progress_current" integer,
	"progress_total" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"leased_until" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"error_code" text,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result_document_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_import_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "user_storage" (
	"user_id" text PRIMARY KEY NOT NULL,
	"used_bytes" bigint DEFAULT 0 NOT NULL,
	"reserved_bytes" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "content_byte_size" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "document" SET "content_byte_size" = octet_length("content"::text);--> statement-breakpoint
ALTER TABLE "document_import" ADD CONSTRAINT "document_import_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_import" ADD CONSTRAINT "document_import_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_import" ADD CONSTRAINT "document_import_parent_id_project_item_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."project_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_storage" ADD CONSTRAINT "user_storage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_import_claim_idx" ON "document_import" USING btree ("status","available_at","created_at");--> statement-breakpoint
CREATE INDEX "document_import_user_status_idx" ON "document_import" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "document_import_project_idx" ON "document_import" USING btree ("project_id","created_at");
--> statement-breakpoint
INSERT INTO "user_storage" ("user_id", "used_bytes", "reserved_bytes")
SELECT
	"user"."id",
	COALESCE("document_totals"."bytes", 0) + COALESCE("asset_totals"."bytes", 0),
	0
FROM "user"
LEFT JOIN (
	SELECT "project"."user_id", SUM("document"."content_byte_size") AS "bytes"
	FROM "document"
	INNER JOIN "project_item" ON "project_item"."id" = "document"."id"
	INNER JOIN "project" ON "project"."id" = "project_item"."project_id"
	GROUP BY "project"."user_id"
) AS "document_totals" ON "document_totals"."user_id" = "user"."id"
LEFT JOIN (
	SELECT "asset"."user_id", SUM("asset"."byte_size") AS "bytes"
	FROM "asset"
	GROUP BY "asset"."user_id"
) AS "asset_totals" ON "asset_totals"."user_id" = "user"."id";
