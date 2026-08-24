import type {
  CreateFlashcardPracticeSessionInput,
  FlashcardRating,
  SubmitFlashcardReviewInput,
} from "@lazuli/shared";
import { and, asc, count, eq, isNull, lte, max, sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import {
  flashcard,
  flashcardCollection,
  flashcardPracticeItem,
  flashcardPracticeSession,
  flashcardReview,
} from "../database/schema/index.ts";
import { summarizeFlashcardContent } from "./flashcard-queries.ts";
import {
  FLASHCARD_SCHEDULER_VERSION,
  previewFlashcardRatings,
  scheduleFlashcardReview,
  type StoredSchedule,
} from "./flashcard-scheduler.ts";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const scheduleSelection = {
  dueAt: flashcard.dueAt,
  stability: flashcard.stability,
  difficulty: flashcard.difficulty,
  elapsedDays: flashcard.elapsedDays,
  scheduledDays: flashcard.scheduledDays,
  learningSteps: flashcard.learningSteps,
  reps: flashcard.reps,
  lapses: flashcard.lapses,
  srsState: flashcard.srsState,
  lastReviewedAt: flashcard.lastReviewedAt,
};

const cardSelection = {
  id: flashcard.id,
  collectionId: flashcard.collectionId,
  question: flashcard.question,
  answer: flashcard.answer,
  questionText: flashcard.questionText,
  answerText: flashcard.answerText,
  contentSchemaVersion: flashcard.contentSchemaVersion,
  dueAt: flashcard.dueAt,
  srsState: flashcard.srsState,
  lastReviewedAt: flashcard.lastReviewedAt,
  archivedAt: flashcard.archivedAt,
  createdAt: flashcard.createdAt,
  updatedAt: flashcard.updatedAt,
};

const ownedSession = async (tx: Transaction, userId: string, sessionId: string, lock = false) => {
  const query = tx
    .select({
      id: flashcardPracticeSession.id,
      collectionId: flashcardPracticeSession.collectionId,
      collectionTitle: flashcardCollection.title,
      status: flashcardPracticeSession.status,
      totalCards: flashcardPracticeSession.totalCards,
      reviewedCards: flashcardPracticeSession.reviewedCards,
      startedAt: flashcardPracticeSession.startedAt,
      lastActivityAt: flashcardPracticeSession.lastActivityAt,
      finishedAt: flashcardPracticeSession.finishedAt,
    })
    .from(flashcardPracticeSession)
    .innerJoin(
      flashcardCollection,
      eq(flashcardCollection.id, flashcardPracticeSession.collectionId),
    )
    .where(
      and(eq(flashcardPracticeSession.id, sessionId), eq(flashcardPracticeSession.userId, userId)),
    )
    .limit(1);
  const [row] = lock ? await query.for("update", { of: flashcardPracticeSession }) : await query;
  return row ?? null;
};

const ratingCounts = async (tx: Transaction, sessionId: string) => {
  const rows = await tx
    .select({ rating: flashcardReview.rating, value: count().mapWith(Number) })
    .from(flashcardReview)
    .where(eq(flashcardReview.sessionId, sessionId))
    .groupBy(flashcardReview.rating);
  const result: Record<FlashcardRating, number> = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const row of rows) result[row.rating] = row.value;
  return result;
};

const nextItem = async (tx: Transaction, sessionId: string, now: Date, lock = false) => {
  const query = tx
    .select({
      itemId: flashcardPracticeItem.id,
      position: flashcardPracticeItem.position,
      ...cardSelection,
      ...scheduleSelection,
    })
    .from(flashcardPracticeItem)
    .innerJoin(
      flashcardPracticeSession,
      eq(flashcardPracticeSession.id, flashcardPracticeItem.sessionId),
    )
    .innerJoin(flashcard, eq(flashcard.id, flashcardPracticeItem.flashcardId))
    .where(
      and(
        eq(flashcardPracticeItem.sessionId, sessionId),
        isNull(flashcardPracticeItem.reviewedAt),
        isNull(flashcard.archivedAt),
        eq(flashcard.collectionId, flashcardPracticeSession.collectionId),
      ),
    )
    .orderBy(asc(flashcardPracticeItem.position))
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  if (!row) return null;
  const schedule: StoredSchedule = row;
  return {
    id: row.itemId,
    position: row.position,
    card: {
      id: row.id,
      collectionId: row.collectionId,
      question: row.question,
      answer: row.answer,
      questionText: row.questionText,
      answerText: row.answerText,
      contentSchemaVersion: row.contentSchemaVersion,
      dueAt: row.dueAt,
      srsState: row.srsState,
      lastReviewedAt: row.lastReviewedAt,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      questionHasImage: summarizeFlashcardContent(row.question).hasImage,
      answerHasImage: summarizeFlashcardContent(row.answer).hasImage,
    },
    intervals: previewFlashcardRatings(schedule, now),
    schedule,
  };
};

const sessionPayload = async (tx: Transaction, userId: string, sessionId: string, now: Date) => {
  let session = await ownedSession(tx, userId, sessionId, true);
  if (!session) return null;
  if (session.status === "active") {
    const [pending] = await tx
      .select({ value: count().mapWith(Number) })
      .from(flashcardPracticeItem)
      .innerJoin(
        flashcardPracticeSession,
        eq(flashcardPracticeSession.id, flashcardPracticeItem.sessionId),
      )
      .innerJoin(flashcard, eq(flashcard.id, flashcardPracticeItem.flashcardId))
      .where(
        and(
          eq(flashcardPracticeItem.sessionId, sessionId),
          isNull(flashcardPracticeItem.reviewedAt),
          isNull(flashcard.archivedAt),
          eq(flashcard.collectionId, flashcardPracticeSession.collectionId),
        ),
      );
    const normalizedTotal = session.reviewedCards + (pending?.value ?? 0);
    if (normalizedTotal !== session.totalCards) {
      await tx
        .update(flashcardPracticeSession)
        .set({ totalCards: normalizedTotal })
        .where(eq(flashcardPracticeSession.id, sessionId));
      session = { ...session, totalCards: normalizedTotal };
    }
  }
  let item = session.status === "active" ? await nextItem(tx, sessionId, now) : null;
  if (session.status === "active" && !item) {
    const finishedAt = now;
    await tx
      .update(flashcardPracticeSession)
      .set({
        status: "completed",
        totalCards: session.reviewedCards,
        finishedAt,
        lastActivityAt: now,
      })
      .where(eq(flashcardPracticeSession.id, sessionId));
    session = { ...session, status: "completed", totalCards: session.reviewedCards, finishedAt };
    item = null;
  }
  const ratings = await ratingCounts(tx, sessionId);
  return { ...session, currentItem: item ? { ...item, schedule: undefined } : null, ratings };
};

export const getPracticeAvailability = async (
  db: Database,
  userId: string,
  collectionId: string,
  now = new Date(),
) =>
  db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ archivedAt: flashcardCollection.archivedAt })
      .from(flashcardCollection)
      .where(and(eq(flashcardCollection.id, collectionId), eq(flashcardCollection.userId, userId)))
      .limit(1);
    if (!collection) return { kind: "not-found" as const };
    const [counts] = await tx
      .select({
        dueCards:
          sql<number>`count(*) filter (where ${flashcard.lastReviewedAt} is not null)`.mapWith(
            Number,
          ),
        newCards: sql<number>`count(*) filter (where ${flashcard.lastReviewedAt} is null)`.mapWith(
          Number,
        ),
      })
      .from(flashcard)
      .where(
        and(
          eq(flashcard.collectionId, collectionId),
          isNull(flashcard.archivedAt),
          lte(flashcard.dueAt, now),
        ),
      );
    const [active] = await tx
      .select({ id: flashcardPracticeSession.id })
      .from(flashcardPracticeSession)
      .where(
        and(
          eq(flashcardPracticeSession.userId, userId),
          eq(flashcardPracticeSession.collectionId, collectionId),
          eq(flashcardPracticeSession.status, "active"),
        ),
      )
      .limit(1);
    const activeSession = active ? await sessionPayload(tx, userId, active.id, now) : null;
    return {
      kind: "ok" as const,
      archived: Boolean(collection.archivedAt),
      activeSession: activeSession?.status === "active" ? activeSession : null,
      newCards: counts?.newCards ?? 0,
      dueCards: counts?.dueCards ?? 0,
      totalAvailable: (counts?.newCards ?? 0) + (counts?.dueCards ?? 0),
    };
  });

export const createPracticeSession = async (
  db: Database,
  userId: string,
  collectionId: string,
  input: CreateFlashcardPracticeSessionInput,
  now = new Date(),
) =>
  db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ archivedAt: flashcardCollection.archivedAt })
      .from(flashcardCollection)
      .where(and(eq(flashcardCollection.id, collectionId), eq(flashcardCollection.userId, userId)))
      .limit(1)
      .for("update");
    if (!collection) return { kind: "not-found" as const };
    if (collection.archivedAt) return { kind: "archived" as const };
    const [duplicateId] = await tx
      .select({
        id: flashcardPracticeSession.id,
        userId: flashcardPracticeSession.userId,
        collectionId: flashcardPracticeSession.collectionId,
      })
      .from(flashcardPracticeSession)
      .where(eq(flashcardPracticeSession.id, input.id))
      .limit(1);
    if (duplicateId) {
      if (duplicateId.userId === userId && duplicateId.collectionId === collectionId)
        return {
          kind: "ok" as const,
          session: await sessionPayload(tx, userId, duplicateId.id, now),
        };
      return { kind: "conflict" as const };
    }
    const [active] = await tx
      .select({ id: flashcardPracticeSession.id })
      .from(flashcardPracticeSession)
      .where(
        and(
          eq(flashcardPracticeSession.userId, userId),
          eq(flashcardPracticeSession.collectionId, collectionId),
          eq(flashcardPracticeSession.status, "active"),
        ),
      )
      .limit(1)
      .for("update");
    const activePayload = active ? await sessionPayload(tx, userId, active.id, now) : null;
    if (activePayload?.status === "active" && !input.abandonActive)
      return { kind: "active" as const, session: activePayload };
    if (activePayload?.status === "active")
      await tx
        .update(flashcardPracticeSession)
        .set({ status: "abandoned", finishedAt: now, lastActivityAt: now })
        .where(eq(flashcardPracticeSession.id, active.id));
    const limit = input.size;
    const cards = await tx
      .select({ id: flashcard.id })
      .from(flashcard)
      .where(
        and(
          eq(flashcard.collectionId, collectionId),
          isNull(flashcard.archivedAt),
          lte(flashcard.dueAt, now),
        ),
      )
      .orderBy(
        asc(sql`${flashcard.lastReviewedAt} is null`),
        asc(flashcard.dueAt),
        asc(flashcard.createdAt),
        asc(flashcard.id),
      )
      .limit(limit);
    if (!cards.length) return { kind: "empty" as const };
    await tx.insert(flashcardPracticeSession).values({
      id: input.id,
      userId,
      collectionId,
      totalCards: cards.length,
      startedAt: now,
      lastActivityAt: now,
      createdAt: now,
    });
    await tx.insert(flashcardPracticeItem).values(
      cards.map(({ id }, position) => ({
        id: crypto.randomUUID(),
        sessionId: input.id,
        flashcardId: id,
        position,
      })),
    );
    return { kind: "ok" as const, session: await sessionPayload(tx, userId, input.id, now) };
  });

export const getPracticeSession = async (
  db: Database,
  userId: string,
  sessionId: string,
  now = new Date(),
) => db.transaction((tx) => sessionPayload(tx, userId, sessionId, now));

export const submitPracticeReview = async (
  db: Database,
  userId: string,
  sessionId: string,
  input: SubmitFlashcardReviewInput,
  now = new Date(),
) =>
  db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        sessionId: flashcardReview.sessionId,
        practiceItemId: flashcardReview.practiceItemId,
      })
      .from(flashcardReview)
      .innerJoin(
        flashcardPracticeSession,
        eq(flashcardPracticeSession.id, flashcardReview.sessionId),
      )
      .where(and(eq(flashcardReview.id, input.id), eq(flashcardPracticeSession.userId, userId)))
      .limit(1);
    if (existing && existing.sessionId === sessionId && existing.practiceItemId === input.itemId)
      return {
        kind: "ok" as const,
        session: await sessionPayload(tx, userId, existing.sessionId, now),
      };
    if (existing) return { kind: "conflict" as const };
    const [foreignReview] = await tx
      .select({ id: flashcardReview.id })
      .from(flashcardReview)
      .where(eq(flashcardReview.id, input.id))
      .limit(1);
    if (foreignReview) return { kind: "conflict" as const };
    const session = await ownedSession(tx, userId, sessionId, true);
    if (!session) return { kind: "not-found" as const };
    if (session.status !== "active") return { kind: "finished" as const };
    const item = await nextItem(tx, sessionId, now, true);
    if (!item) return { kind: "finished" as const };
    if (item.id !== input.itemId) return { kind: "conflict" as const };
    const previous = item.schedule;
    const { schedule } = scheduleFlashcardReview(previous, input.rating, now);
    await tx.insert(flashcardReview).values({
      id: input.id,
      flashcardId: item.card.id,
      sessionId,
      practiceItemId: item.id,
      rating: input.rating,
      reviewedAt: now,
      previousDueAt: previous.dueAt,
      nextDueAt: schedule.dueAt,
      previousState: previous.srsState,
      nextState: schedule.srsState,
      stability: schedule.stability,
      difficulty: schedule.difficulty,
      elapsedDays: schedule.elapsedDays,
      scheduledDays: schedule.scheduledDays,
      learningSteps: schedule.learningSteps,
      schedulerVersion: FLASHCARD_SCHEDULER_VERSION,
    });
    await tx
      .update(flashcard)
      .set({
        dueAt: schedule.dueAt,
        srsState: schedule.srsState,
        stability: schedule.stability,
        difficulty: schedule.difficulty,
        elapsedDays: schedule.elapsedDays,
        scheduledDays: schedule.scheduledDays,
        learningSteps: schedule.learningSteps,
        reps: schedule.reps,
        lapses: schedule.lapses,
        lastReviewedAt: schedule.lastReviewedAt,
        schedulerVersion: FLASHCARD_SCHEDULER_VERSION,
        updatedAt: now,
      })
      .where(eq(flashcard.id, item.card.id));
    if (input.rating === "again") {
      const [lastItem] = await tx
        .select({ position: max(flashcardPracticeItem.position) })
        .from(flashcardPracticeItem)
        .where(eq(flashcardPracticeItem.sessionId, sessionId));
      await tx
        .update(flashcardPracticeItem)
        .set({ reviewId: input.id, position: (lastItem?.position ?? item.position) + 1 })
        .where(eq(flashcardPracticeItem.id, item.id));
      await tx
        .update(flashcardPracticeSession)
        .set({ lastActivityAt: now })
        .where(eq(flashcardPracticeSession.id, sessionId));
    } else {
      await tx
        .update(flashcardPracticeItem)
        .set({ reviewId: input.id, reviewedAt: now })
        .where(eq(flashcardPracticeItem.id, item.id));
      await tx
        .update(flashcardPracticeSession)
        .set({
          reviewedCards: sql`${flashcardPracticeSession.reviewedCards} + 1`,
          lastActivityAt: now,
        })
        .where(eq(flashcardPracticeSession.id, sessionId));
    }
    return { kind: "ok" as const, session: await sessionPayload(tx, userId, sessionId, now) };
  });

export const abandonPracticeSession = async (
  db: Database,
  userId: string,
  sessionId: string,
  now = new Date(),
) =>
  db.transaction(async (tx) => {
    const session = await ownedSession(tx, userId, sessionId, true);
    if (!session) return false;
    if (session.status === "active")
      await tx
        .update(flashcardPracticeSession)
        .set({ status: "abandoned", finishedAt: now, lastActivityAt: now })
        .where(eq(flashcardPracticeSession.id, sessionId));
    return true;
  });
