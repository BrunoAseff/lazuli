CREATE TYPE "public"."ai_credit_bucket_origin" AS ENUM('monthly', 'admin_bonus', 'legacy', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."billing_subscription_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TYPE "public"."billing_webhook_status" AS ENUM('pending', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."commercial_plan" AS ENUM('basic', 'essential', 'specialist');--> statement-breakpoint
CREATE TYPE "public"."stripe_environment" AS ENUM('test', 'live');--> statement-breakpoint
CREATE TABLE "ai_credit_bucket" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"origin" "ai_credit_bucket_origin" NOT NULL,
	"plan" text,
	"total_credits" integer NOT NULL,
	"remaining_credits" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"source_id" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_bucket_amounts_check" CHECK ("ai_credit_bucket"."total_credits" >= 0 and "ai_credit_bucket"."remaining_credits" >= 0 and "ai_credit_bucket"."remaining_credits" <= "ai_credit_bucket"."total_credits")
);
--> statement-breakpoint
CREATE TABLE "ai_credit_reservation_allocation" (
	"generation_id" text NOT NULL,
	"bucket_id" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_reservation_amount_check" CHECK ("ai_credit_reservation_allocation"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "admin_plan_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" "commercial_plan" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"reason" text NOT NULL,
	"operator_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customer" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"environment" "stripe_environment" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customer_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "billing_subscription" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"environment" "stripe_environment" NOT NULL,
	"plan" "commercial_plan" NOT NULL,
	"status" "billing_subscription_status" NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"access_until" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"last_stripe_event_id" text,
	"provider_updated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_event" (
	"stripe_event_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" "billing_webhook_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"provider_created_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"target_user_id" text NOT NULL,
	"operator_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"environment" text NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_audit_reason_check" CHECK (length(trim("commercial_audit_log"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "commercial_maintenance_lease" (
	"name" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"leased_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD COLUMN "bucket_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "quota_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_credit_bucket" ADD CONSTRAINT "ai_credit_bucket_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_reservation_allocation" ADD CONSTRAINT "ai_credit_reservation_allocation_generation_id_ai_generation_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_reservation_allocation" ADD CONSTRAINT "ai_credit_reservation_allocation_bucket_id_ai_credit_bucket_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."ai_credit_bucket"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_plan_grant" ADD CONSTRAINT "admin_plan_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customer" ADD CONSTRAINT "billing_customer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_audit_log" ADD CONSTRAINT "commercial_audit_log_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_bucket_user_idempotency_idx" ON "ai_credit_bucket" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_credit_bucket_spend_idx" ON "ai_credit_bucket" USING btree ("user_id","expires_at","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_reservation_allocation_pk" ON "ai_credit_reservation_allocation" USING btree ("generation_id","bucket_id");--> statement-breakpoint
CREATE INDEX "ai_credit_reservation_bucket_idx" ON "ai_credit_reservation_allocation" USING btree ("bucket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_plan_grant_operator_idempotency_idx" ON "admin_plan_grant" USING btree ("operator_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "admin_plan_grant_active_idx" ON "admin_plan_grant" USING btree ("user_id","revoked_at","ends_at");--> statement-breakpoint
CREATE INDEX "billing_subscription_status_idx" ON "billing_subscription" USING btree ("status","access_until");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_audit_operator_idempotency_idx" ON "commercial_audit_log" USING btree ("operator_id","target_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "commercial_audit_target_created_idx" ON "commercial_audit_log" USING btree ("target_user_id","created_at");--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_bucket_id_ai_credit_bucket_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."ai_credit_bucket"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_user_quota_idx" ON "project" USING btree ("user_id","quota_exempt");--> statement-breakpoint
-- Preserve every pre-commercial spendable balance as a non-expiring legacy bucket.
-- This is additive: the aggregate account and its historical ledger are not rewritten.
INSERT INTO "ai_credit_bucket" (
	"id",
	"user_id",
	"origin",
	"plan",
	"total_credits",
	"remaining_credits",
	"starts_at",
	"expires_at",
	"source_id",
	"idempotency_key"
)
SELECT
	'legacy:' || "user_id",
	"user_id",
	'legacy'::"ai_credit_bucket_origin",
	NULL,
	"available_balance",
	"available_balance",
	"created_at",
	NULL,
	'pre-commercial-balance',
	'commercial-migration-v1'
FROM "ai_credit_account"
WHERE "available_balance" > 0
ON CONFLICT ("user_id", "idempotency_key") DO NOTHING;
