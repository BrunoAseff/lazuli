WITH "ranked_reviews" AS (
	SELECT r."id",
		row_number() OVER (
			PARTITION BY r."practice_item_id"
			ORDER BY (i."review_id" = r."id") DESC, r."reviewed_at", r."id"
		) AS "position"
	FROM "flashcard_review" r
	LEFT JOIN "flashcard_practice_item" i ON i."id" = r."practice_item_id"
)
DELETE FROM "flashcard_review"
WHERE "id" IN (SELECT "id" FROM "ranked_reviews" WHERE "position" > 1);--> statement-breakpoint
DROP INDEX "flashcard_review_practice_item_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "flashcard_review_practice_item_idx" ON "flashcard_review" USING btree ("practice_item_id");
