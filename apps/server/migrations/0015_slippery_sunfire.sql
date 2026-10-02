CREATE TYPE "public"."ai_credit_actor_type" AS ENUM('system', 'user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."ai_credit_event_type" AS ENUM('grant', 'reserve', 'consume', 'release', 'adjustment');--> statement-breakpoint
CREATE TABLE "ai_credit_account" (
	"user_id" text PRIMARY KEY NOT NULL,
	"available_balance" integer DEFAULT 0 NOT NULL,
	"reserved_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_account_available_check" CHECK ("ai_credit_account"."available_balance" >= 0),
	CONSTRAINT "ai_credit_account_reserved_check" CHECK ("ai_credit_account"."reserved_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"generation_id" text,
	"type" "ai_credit_event_type" NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"actor_type" "ai_credit_actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_ledger_amount_check" CHECK ("ai_credit_ledger"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "ai_generation" ADD COLUMN "estimated_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_generation" ADD COLUMN "reserved_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_generation" ADD COLUMN "consumed_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_generation" ADD COLUMN "regeneration_of_id" text;--> statement-breakpoint
ALTER TABLE "ai_credit_account" ADD CONSTRAINT "ai_credit_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_generation_id_ai_generation_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_ledger_user_idempotency_idx" ON "ai_credit_ledger" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_credit_ledger_user_created_idx" ON "ai_credit_ledger" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ai_credit_ledger_generation_idx" ON "ai_credit_ledger" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "ai_generation_regeneration_idx" ON "ai_generation" USING btree ("regeneration_of_id","status");--> statement-breakpoint
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_credit_counts_check" CHECK ("ai_generation"."estimated_credits" >= 0 and "ai_generation"."reserved_credits" >= 0 and "ai_generation"."consumed_credits" >= 0 and "ai_generation"."consumed_credits" <= "ai_generation"."estimated_credits");