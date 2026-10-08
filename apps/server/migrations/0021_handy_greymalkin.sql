DROP INDEX "flashcard_review_practice_item_idx";--> statement-breakpoint
CREATE INDEX "flashcard_review_practice_item_idx" ON "flashcard_review" USING btree ("practice_item_id");