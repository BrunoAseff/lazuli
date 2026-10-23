-- Index only human-readable text, never serialized block IDs, URLs or props.
CREATE FUNCTION lazuli_content_text(content jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(jsonb_path_query_array(content, 'strict $.**.text', '{}'::jsonb, true)) AS texts(value);
$$;
--> statement-breakpoint
CREATE FUNCTION lazuli_search_vector(content text) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT to_tsvector('simple'::regconfig, public.unaccent(coalesce(content, '')));
$$;
--> statement-breakpoint
CREATE INDEX project_search_title_idx ON project USING gin (lazuli_search_vector(title));
--> statement-breakpoint
CREATE INDEX project_item_search_title_idx ON project_item USING gin (lazuli_search_vector(title));
--> statement-breakpoint
CREATE INDEX document_search_content_idx ON document USING gin (lazuli_search_vector(lazuli_content_text(content)));
--> statement-breakpoint
CREATE INDEX flashcard_collection_search_title_idx ON flashcard_collection USING gin (lazuli_search_vector(title));
--> statement-breakpoint
CREATE INDEX flashcard_search_question_idx ON flashcard USING gin (lazuli_search_vector(question_text));
--> statement-breakpoint
CREATE INDEX flashcard_search_answer_idx ON flashcard USING gin (lazuli_search_vector(answer_text));
--> statement-breakpoint
CREATE INDEX quiz_collection_search_title_idx ON quiz_collection USING gin (lazuli_search_vector(title));
--> statement-breakpoint
CREATE INDEX quiz_question_search_content_idx ON quiz_question USING gin (lazuli_search_vector(content_text));
