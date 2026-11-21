import { and, count, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import type { Database, QueryExecutor } from "../database/client.ts";
import {
  flashcard,
  flashcardCollection,
  flashcardPracticeSession,
  flashcardReview,
} from "../database/schema/index.ts";
import { flashcardMastered } from "../stone/mastery-sql.ts";
import { deleteCards } from "./flashcard-queries.ts";
import {
  createStudyCollectionQueries,
  type StudyCollectionRow,
} from "../study-collections/study-collection-queries.ts";

const COLLECTION_DELETE_BATCH_SIZE = 500;

const enrichCollections = async (
  database: QueryExecutor,
  rows: StudyCollectionRow[],
  now: Date,
) => {
  if (rows.length === 0) return [];
  const collectionIds = rows.map(({ id }) => id);
  const cardMetrics = await database
    .select({
      collectionId: flashcard.collectionId,
      totalCards: count().mapWith(Number),
      newCards: sql<number>`count(*) filter (where ${flashcard.srsState} = 'new')`.mapWith(Number),
      dueCards: sql<number>`count(*) filter (where ${lte(flashcard.dueAt, now)})`.mapWith(Number),
      // Mastered: reviewed into a long interval, not lapsed, and not due again yet.
      masteredCards:
        // Mastered and not due: a due card shows as "para revisar" first, since it needs a review.
        sql<number>`count(*) filter (where ${flashcardMastered(flashcard.srsState, flashcard.scheduledDays)} and ${gt(flashcard.dueAt, now)})`.mapWith(
          Number,
        ),
      nextPracticeAt:
        sql<Date | null>`min(${flashcard.dueAt}) filter (where ${gt(flashcard.dueAt, now)})`.mapWith(
          flashcard.dueAt,
        ),
    })
    .from(flashcard)
    .where(and(inArray(flashcard.collectionId, collectionIds), isNull(flashcard.archivedAt)))
    .groupBy(flashcard.collectionId);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
  const reviewMetrics = await database
    .select({
      collectionId: flashcardPracticeSession.collectionId,
      reviewsLastSevenDays: count().mapWith(Number),
    })
    .from(flashcardReview)
    .innerJoin(flashcardPracticeSession, eq(flashcardPracticeSession.id, flashcardReview.sessionId))
    .where(
      and(
        inArray(flashcardPracticeSession.collectionId, collectionIds),
        gte(flashcardReview.reviewedAt, weekStart),
      ),
    )
    .groupBy(flashcardPracticeSession.collectionId);
  const cardsByCollection = new Map(cardMetrics.map((item) => [item.collectionId, item]));
  const reviewsByCollection = new Map(reviewMetrics.map((item) => [item.collectionId, item]));

  return rows.map((row) => {
    const metrics = cardsByCollection.get(row.id);
    const reviews = reviewsByCollection.get(row.id);
    return {
      id: row.id,
      title: row.title,
      project:
        row.projectId && row.projectTitle ? { id: row.projectId, title: row.projectTitle } : null,
      archivedAt: row.archivedAt,
      totalCards: metrics?.totalCards ?? 0,
      newCards: metrics?.newCards ?? 0,
      dueCards: metrics?.dueCards ?? 0,
      masteredCards: metrics?.masteredCards ?? 0,
      nextPracticeAt: metrics?.nextPracticeAt ?? null,
      reviewsLastSevenDays: reviews?.reviewsLastSevenDays ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
};

const flashcardCollectionQueries = createStudyCollectionQueries({
  enrich: (database, _userId, rows, now) => enrichCollections(database, rows, now),
  favoriteKind: "flashcards",
  table: flashcardCollection,
});

export const listFlashcardCollections = flashcardCollectionQueries.list;
export const getFlashcardCollection = flashcardCollectionQueries.get;
export const createFlashcardCollection = flashcardCollectionQueries.create;
export const updateFlashcardCollection = flashcardCollectionQueries.update;

export const deleteFlashcardCollection = async (
  database: Database,
  userId: string,
  collectionId: string,
) =>
  database.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: flashcardCollection.id })
      .from(flashcardCollection)
      .where(and(eq(flashcardCollection.id, collectionId), eq(flashcardCollection.userId, userId)))
      .limit(1)
      .for("update");
    if (!owned) return false;
    while (true) {
      const cards = await tx
        .select({ id: flashcard.id })
        .from(flashcard)
        .where(eq(flashcard.collectionId, collectionId))
        .limit(COLLECTION_DELETE_BATCH_SIZE)
        .for("update", { of: flashcard });
      if (!cards.length) break;
      await deleteCards(
        tx,
        userId,
        cards.map(({ id }) => id),
      );
    }
    await tx.delete(flashcardCollection).where(eq(flashcardCollection.id, collectionId));
    return true;
  });
