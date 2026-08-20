CREATE TYPE "public"."project_item_type" AS ENUM('folder', 'document');--> statement-breakpoint
CREATE TABLE "asset" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"document_id" text NOT NULL,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_item" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_id" text,
	"type" "project_item_type" NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "project_item" ("id", "project_id", "parent_id", "type", "title", "position", "created_at", "updated_at")
SELECT "id", "project_id", NULL, 'document', "title", 0, "created_at", "updated_at"
FROM "document";
--> statement-breakpoint
ALTER TABLE "document" DROP CONSTRAINT "document_project_id_project_id_fk";
--> statement-breakpoint
DROP INDEX "document_project_updated_id_idx";--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "content" jsonb DEFAULT '[{"id":"initial","type":"paragraph","props":{},"content":[],"children":[]}]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "content_schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_item" ADD CONSTRAINT "project_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_item" ADD CONSTRAINT "project_item_parent_id_project_item_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."project_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_object_key_unique" ON "asset" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "asset_document_idx" ON "asset" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "asset_user_idx" ON "asset" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "project_item_parent_position_idx" ON "project_item" USING btree ("project_id","parent_id","position","id");--> statement-breakpoint
CREATE INDEX "project_item_project_updated_idx" ON "project_item" USING btree ("project_id","updated_at","id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_id_project_item_id_fk" FOREIGN KEY ("id") REFERENCES "public"."project_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_updated_idx" ON "document" USING btree ("updated_at","id");--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN "title";
