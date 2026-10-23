CREATE TABLE "user_interface_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interface_theme_check" CHECK ("user_interface_preference"."theme" in ('system', 'light', 'dark'))
);
--> statement-breakpoint
ALTER TABLE "user_interface_preference" ADD CONSTRAINT "user_interface_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;