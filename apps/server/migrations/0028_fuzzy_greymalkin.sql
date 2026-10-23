CREATE TABLE "user_favorite" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"document_id" text,
	"flashcard_collection_id" text,
	"quiz_collection_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_single_target" CHECK (num_nonnulls("user_favorite"."project_id", "user_favorite"."document_id", "user_favorite"."flashcard_collection_id", "user_favorite"."quiz_collection_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_document_id_project_item_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_flashcard_collection_id_flashcard_collection_id_fk" FOREIGN KEY ("flashcard_collection_id") REFERENCES "public"."flashcard_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_quiz_collection_id_quiz_collection_id_fk" FOREIGN KEY ("quiz_collection_id") REFERENCES "public"."quiz_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_user_project" ON "user_favorite" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_user_document" ON "user_favorite" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_user_flashcards" ON "user_favorite" USING btree ("user_id","flashcard_collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_user_quizzes" ON "user_favorite" USING btree ("user_id","quiz_collection_id");--> statement-breakpoint
CREATE INDEX "favorite_user_created" ON "user_favorite" USING btree ("user_id","created_at","id");