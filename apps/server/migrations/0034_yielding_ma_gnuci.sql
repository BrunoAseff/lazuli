ALTER TABLE "quiz_attempt_item" ADD COLUMN "original_question_id" text;--> statement-breakpoint
ALTER TABLE "quiz_attempt_item" ADD COLUMN "question_fingerprint" text;
--> statement-breakpoint
-- IDs and the user's chosen answer do not participate in the version identity.
CREATE FUNCTION lazuli_quiz_fingerprint(question jsonb, options jsonb, correct_id text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT md5(jsonb_build_array(question, (
    SELECT jsonb_agg(jsonb_build_object('text',o->>'text','position',(o->>'position')::int,
      'correct',o->>'id'=correct_id) ORDER BY (o->>'position')::int)
    FROM jsonb_array_elements(coalesce(options,'[]'::jsonb)) o
  ))::text)
$$;
--> statement-breakpoint
UPDATE quiz_attempt_item SET original_question_id=question_id,
  question_fingerprint=lazuli_quiz_fingerprint(question,options,correct_option_id);
