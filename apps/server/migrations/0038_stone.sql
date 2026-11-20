CREATE TABLE "user_stone_level" (
	"user_id" text NOT NULL,
	"level" integer NOT NULL,
	"reached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_stone_level_user_id_level_pk" PRIMARY KEY("user_id","level"),
	CONSTRAINT "user_stone_level_check" CHECK ("user_stone_level"."level" between 2 and 5)
);
--> statement-breakpoint
CREATE TABLE "user_study_goal" (
	"user_id" text NOT NULL,
	"effective_from" date NOT NULL,
	"counts" text DEFAULT 'both' NOT NULL,
	"practices" integer DEFAULT 2 NOT NULL,
	"days" integer DEFAULT 127 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_study_goal_user_id_effective_from_pk" PRIMARY KEY("user_id","effective_from"),
	CONSTRAINT "user_study_goal_counts_check" CHECK ("user_study_goal"."counts" in ('both', 'flashcards', 'quizzes')),
	CONSTRAINT "user_study_goal_practices_check" CHECK ("user_study_goal"."practices" between 1 and 10),
	CONSTRAINT "user_study_goal_days_check" CHECK ("user_study_goal"."days" between 1 and 127)
);
--> statement-breakpoint
ALTER TABLE "user_stone_level" ADD CONSTRAINT "user_stone_level_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_study_goal" ADD CONSTRAINT "user_study_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;