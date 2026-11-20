import { MASTERED_FLASHCARD_DAYS } from "@lazuli/shared";
import { type SQLWrapper, sql } from "drizzle-orm";

/**
 * The one rule for a flashcard mastered right now: in review, scheduled MASTERED_FLASHCARD_DAYS or
 * more ahead (a lapse sends it back to relearning). Used by "Sua pedra" and the collections' gold.
 * Takes the card's state and interval columns, from drizzle or from a raw alias.
 */
export const flashcardMastered = (state: SQLWrapper, scheduledDays: SQLWrapper) =>
  sql`(${state} = 'review' and ${scheduledDays} >= ${MASTERED_FLASHCARD_DAYS})`;

/** The same rule for a raw query alias ("f" in `flashcard f`). */
export const flashcardMasteredAs = (alias: string) =>
  flashcardMastered(sql.raw(`${alias}.srs_state`), sql.raw(`${alias}.scheduled_days`));
