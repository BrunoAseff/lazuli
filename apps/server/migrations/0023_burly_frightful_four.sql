CREATE TYPE "public"."analytics_consent_status" AS ENUM('granted', 'denied');--> statement-breakpoint
CREATE TABLE "user_analytics_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" "analytics_consent_status" NOT NULL,
	"version" integer NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_analytics_preference" ADD CONSTRAINT "user_analytics_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;