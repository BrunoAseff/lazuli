CREATE TABLE "analytics_consent_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"version" integer NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_acceptance" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"terms_version" text NOT NULL,
	"privacy_version" text NOT NULL,
	"terms_hash" text NOT NULL,
	"privacy_hash" text NOT NULL,
	"action_label" text NOT NULL,
	"source" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_consent_event" ADD CONSTRAINT "analytics_consent_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptance" ADD CONSTRAINT "legal_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_consent_event_user_idx" ON "analytics_consent_event" USING btree ("user_id","decided_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_acceptance_user_edition_idx" ON "legal_acceptance" USING btree ("user_id","terms_hash","privacy_hash");