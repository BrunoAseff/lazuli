CREATE TABLE "study_material_reference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"anchor_id" text,
	"flashcard_id" text,
	"quiz_question_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_material_reference_one_target_check" CHECK (num_nonnulls("study_material_reference"."flashcard_id", "study_material_reference"."quiz_question_id") = 1),
	CONSTRAINT "study_material_reference_anchor_length_check" CHECK ("study_material_reference"."anchor_id" is null or length("study_material_reference"."anchor_id") between 1 and 128)
);
--> statement-breakpoint
ALTER TABLE "study_material_reference" ADD CONSTRAINT "study_material_reference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_material_reference" ADD CONSTRAINT "study_material_reference_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_material_reference" ADD CONSTRAINT "study_material_reference_flashcard_id_flashcard_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_material_reference" ADD CONSTRAINT "study_material_reference_quiz_question_id_quiz_question_id_fk" FOREIGN KEY ("quiz_question_id") REFERENCES "public"."quiz_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_material_reference_document_anchor_idx" ON "study_material_reference" USING btree ("document_id","anchor_id","created_at","id");--> statement-breakpoint
CREATE INDEX "study_material_reference_user_created_idx" ON "study_material_reference" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "study_material_reference_flashcard_idx" ON "study_material_reference" USING btree ("flashcard_id","created_at");--> statement-breakpoint
CREATE INDEX "study_material_reference_quiz_question_idx" ON "study_material_reference" USING btree ("quiz_question_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "study_material_reference_flashcard_source_unique_idx" ON "study_material_reference" USING btree ("flashcard_id","document_id","anchor_id") WHERE "study_material_reference"."flashcard_id" is not null and "study_material_reference"."anchor_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "study_material_reference_flashcard_document_unique_idx" ON "study_material_reference" USING btree ("flashcard_id","document_id") WHERE "study_material_reference"."flashcard_id" is not null and "study_material_reference"."anchor_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "study_material_reference_quiz_source_unique_idx" ON "study_material_reference" USING btree ("quiz_question_id","document_id","anchor_id") WHERE "study_material_reference"."quiz_question_id" is not null and "study_material_reference"."anchor_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "study_material_reference_quiz_document_unique_idx" ON "study_material_reference" USING btree ("quiz_question_id","document_id") WHERE "study_material_reference"."quiz_question_id" is not null and "study_material_reference"."anchor_id" is null;