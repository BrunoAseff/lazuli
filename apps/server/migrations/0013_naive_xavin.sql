CREATE TYPE "public"."ai_generation_origin" AS ENUM('internal', 'document_selection', 'document', 'collection', 'material');--> statement-breakpoint
CREATE TYPE "public"."ai_generation_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_generation_type" AS ENUM('foundation_draft', 'selection_generation', 'collection_generation', 'reference_resolution', 'material_improvement');--> statement-breakpoint
CREATE TABLE "ai_generation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "ai_generation_type" NOT NULL,
	"origin" "ai_generation_origin" NOT NULL,
	"status" "ai_generation_status" DEFAULT 'running' NOT NULL,
	"idempotency_key" text NOT NULL,
	"prompt_version" text NOT NULL,
	"provider" text NOT NULL,
	"requested_model" text NOT NULL,
	"effective_model" text,
	"source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_fingerprint" text NOT NULL,
	"requested_items" integer NOT NULL,
	"valid_items" integer DEFAULT 0 NOT NULL,
	"approved_items" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"cached_input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"estimated_cost_micro_usd" bigint,
	"latency_ms" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "ai_generation_requested_items_check" CHECK ("ai_generation"."requested_items" > 0),
	CONSTRAINT "ai_generation_item_counts_check" CHECK ("ai_generation"."valid_items" >= 0 and "ai_generation"."approved_items" >= 0 and "ai_generation"."approved_items" <= "ai_generation"."valid_items"),
	CONSTRAINT "ai_generation_attempts_check" CHECK ("ai_generation"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generation_user_idempotency_idx" ON "ai_generation" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_generation_user_created_idx" ON "ai_generation" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ai_generation_user_status_created_idx" ON "ai_generation" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ai_generation_expiry_idx" ON "ai_generation" USING btree ("expires_at");