-- Headline extraction preserves original accents while matching the normalized index.
CREATE TEXT SEARCH CONFIGURATION lazuli_headline (COPY = pg_catalog.simple);
--> statement-breakpoint
ALTER TEXT SEARCH CONFIGURATION lazuli_headline ALTER MAPPING FOR hword, hword_part, word WITH public.unaccent, pg_catalog.simple;
--> statement-breakpoint
DROP INDEX flashcard_search_question_idx;
--> statement-breakpoint
DROP INDEX flashcard_search_answer_idx;
--> statement-breakpoint
DROP INDEX quiz_question_search_content_idx;
--> statement-breakpoint
CREATE INDEX flashcard_search_question_idx ON flashcard USING gin (lazuli_search_vector(lazuli_content_text(question)));
--> statement-breakpoint
CREATE INDEX flashcard_search_answer_idx ON flashcard USING gin (lazuli_search_vector(lazuli_content_text(answer)));
--> statement-breakpoint
CREATE INDEX quiz_question_search_content_idx ON quiz_question USING gin (lazuli_search_vector(lazuli_content_text(content)));
