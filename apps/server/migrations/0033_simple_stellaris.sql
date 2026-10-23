CREATE TABLE "email_rollout" (
	"key" text PRIMARY KEY NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "email_rollout" ("key") VALUES ('lifecycle-v1');
