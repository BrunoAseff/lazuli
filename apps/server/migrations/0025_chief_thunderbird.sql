CREATE TYPE "public"."account_export_status" AS ENUM('queued', 'processing', 'ready', 'failed', 'expired', 'revoked');--> statement-breakpoint
CREATE TABLE "account_export" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"categories" jsonb NOT NULL,
	"status" "account_export_status" DEFAULT 'queued' NOT NULL,
	"object_key" text,
	"byte_size" bigint,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"leased_until" timestamp with time zone,
	"error_code" text,
	"ready_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_export_attempts_check" CHECK ("account_export"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_study_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"desired_retention" integer DEFAULT 90 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_study_preference_retention_check" CHECK ("user_study_preference"."desired_retention" between 80 and 95)
);
--> statement-breakpoint
ALTER TABLE "account_export" ADD CONSTRAINT "account_export_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_study_preference" ADD CONSTRAINT "user_study_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_export_claim_idx" ON "account_export" USING btree ("status","available_at","created_at");--> statement-breakpoint
CREATE INDEX "account_export_user_created_idx" ON "account_export" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "account_export_expiry_idx" ON "account_export" USING btree ("status","expires_at");