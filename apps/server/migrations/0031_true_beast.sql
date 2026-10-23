CREATE TABLE "email_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"deduplication_key" text NOT NULL,
	"user_id" text,
	"recipient" text,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"rendered" jsonb,
	"ready_when" text DEFAULT 'immediate' NOT NULL,
	"after_key" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"leased_until" timestamp with time zone,
	"provider_id" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_deduplication" ON "email_outbox" USING btree ("deduplication_key");--> statement-breakpoint
CREATE INDEX "email_outbox_claim" ON "email_outbox" USING btree ("status","available_at","created_at");