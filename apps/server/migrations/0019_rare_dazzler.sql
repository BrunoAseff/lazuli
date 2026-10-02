ALTER TABLE "ai_generation" ADD COLUMN "available_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_generation" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "ai_generation" ADD COLUMN "leased_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_generation" ADD COLUMN "cancel_requested_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ai_generation_claim_idx" ON "ai_generation" USING btree ("type","status","available_at","created_at");