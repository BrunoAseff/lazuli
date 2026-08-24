import type {
  CreateFlashcardCollectionInput,
  FlashcardCollectionListQuery,
  UpdateFlashcardCollectionInput,
} from "@lazuli/shared";
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { escapeLikePattern } from "../database/sql-search.ts";
import {
  flashcard,
  flashcardCollection,
  flashcardPracticeSession,
  flashcardReview,
  project,
} from "../database/schema/index.ts";
import { deleteCards } from "./flashcard-queries.ts";

const collectionSelection = {
  id: flashcardCollection.id,
  title: flashcardCollection.title,
  projectId: project.id,
  projectTitle: project.title,
  archivedAt: flashcardCollection.archivedAt,
  createdAt: flashcardCollection.createdAt,
  updatedAt: flashcardCollection.updatedAt,
};

type CollectionRow = {
  id: string;
  title: string;
  projectId: string | null;
  projectTitle: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type QueryExecutor = Database | Transaction;

const enrichCollections = async (database: QueryExecutor, rows: CollectionRow[], now: Date) => {
  if (rows.length === 0) return [];
  const collectionIds = rows.map(({ id }) => id);
  const cardMetrics = await database
    .select({
      collectionId: flashcard.collectionId,
      totalCards: count().mapWith(Number),
      newCards: sql<number>`count(*) filter (where ${flashcard.srsState} = 'new')`.mapWith(Number),
      studiedCards:
        sql<number>`count(*) filter (where ${flashcard.lastReviewedAt} is not null)`.mapWith(
          Number,
        ),
      dueCards: sql<number>`count(*) filter (where ${lte(flashcard.dueAt, now)})`.mapWith(Number),
      nextPracticeAt:
        sql<Date | null>`min(${flashcard.dueAt}) filter (where ${gt(flashcard.dueAt, now)})`.mapWith(
          flashcard.dueAt,
        ),
      lastReviewedAt: sql<Date | null>`max(${flashcard.lastReviewedAt})`.mapWith(
        flashcard.lastReviewedAt,
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
      successfulReviews:
        sql<number>`count(*) filter (where ${flashcardReview.rating} in ('hard', 'good', 'easy'))`.mapWith(
          Number,
        ),
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
      studiedCards: metrics?.studiedCards ?? 0,
      dueCards: metrics?.dueCards ?? 0,
      nextPracticeAt: metrics?.nextPracticeAt ?? null,
      reviewsLastSevenDays: reviews?.reviewsLastSevenDays ?? 0,
      successRateLastSevenDays: reviews?.reviewsLastSevenDays
        ? reviews.successfulReviews / reviews.reviewsLastSevenDays
        : null,
      lastReviewedAt: metrics?.lastReviewedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
};

const createCollectionWhere = (userId: string, input: FlashcardCollectionListQuery) =>
  and(
    eq(flashcardCollection.userId, userId),
    input.status === "active"
      ? isNull(flashcardCollection.archivedAt)
      : isNotNull(flashcardCollection.archivedAt),
    input.project === "none"
      ? isNull(flashcardCollection.projectId)
      : input.project
        ? eq(flashcardCollection.projectId, input.project)
        : undefined,
    input.query
      ? sql<boolean>`unaccent(lower(${flashcardCollection.title})) LIKE unaccent(lower(${`%${escapeLikePattern(input.query)}%`})) ESCAPE ${"\\"}`
      : undefined,
  );

export const listFlashcardCollections = async (
  database: Database,
  userId: string,
  input: FlashcardCollectionListQuery,
  now = new Date(),
) => {
  const where = createCollectionWhere(userId, input);
  const [total] = await database.select({ value: count() }).from(flashcardCollection).where(where);
  const rows = await database
    .select(collectionSelection)
    .from(flashcardCollection)
    .leftJoin(
      project,
      and(eq(project.id, flashcardCollection.projectId), eq(project.userId, userId)),
    )
    .where(where)
    .orderBy(desc(flashcardCollection.createdAt), desc(flashcardCollection.id))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);
  const totalItems = total?.value ?? 0;
  return {
    items: await enrichCollections(database, rows, now),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
    },
  };
};

export const getFlashcardCollection = async (
  database: QueryExecutor,
  userId: string,
  collectionId: string,
  now = new Date(),
) => {
  const [row] = await database
    .select(collectionSelection)
    .from(flashcardCollection)
    .leftJoin(
      project,
      and(eq(project.id, flashcardCollection.projectId), eq(project.userId, userId)),
    )
    .where(and(eq(flashcardCollection.id, collectionId), eq(flashcardCollection.userId, userId)))
    .limit(1);
  if (!row) return null;
  return (await enrichCollections(database, [row], now))[0] ?? null;
};

const ownsProject = async (database: QueryExecutor, userId: string, projectId: string) => {
  const [owned] = await database
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1)
    .for("share");
  return Boolean(owned);
};

export const createFlashcardCollection = async (
  database: Database,
  userId: string,
  input: CreateFlashcardCollectionInput,
) =>
  database.transaction(async (tx) => {
    if (input.projectId && !(await ownsProject(tx, userId, input.projectId)))
      return { kind: "project-not-found" as const };
    const [inserted] = await tx
      .insert(flashcardCollection)
      .values({ ...input, userId })
      .onConflictDoNothing({ target: flashcardCollection.id })
      .returning({ id: flashcardCollection.id });
    if (inserted)
      return {
        kind: "ok" as const,
        created: true,
        collection: await getFlashcardCollection(tx, userId, inserted.id),
      };
    const existing = await getFlashcardCollection(tx, userId, input.id);
    if (
      !existing ||
      existing.title !== input.title ||
      (existing.project?.id ?? null) !== input.projectId ||
      existing.archivedAt !== null
    )
      return { kind: "conflict" as const };
    return { kind: "ok" as const, created: false, collection: existing };
  });

export const updateFlashcardCollection = async (
  database: Database,
  userId: string,
  collectionId: string,
  input: UpdateFlashcardCollectionInput,
) =>
  database.transaction(async (tx) => {
    if (input.projectId && !(await ownsProject(tx, userId, input.projectId)))
      return { kind: "project-not-found" as const };
    const changes = [];
    const values: {
      title?: string;
      projectId?: string | null;
      archivedAt?: Date | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (input.title !== undefined) {
      values.title = input.title;
      changes.push(sql`${flashcardCollection.title} is distinct from ${input.title}`);
    }
    if (input.projectId !== undefined) {
      values.projectId = input.projectId;
      changes.push(sql`${flashcardCollection.projectId} is distinct from ${input.projectId}`);
    }
    if (input.archived !== undefined) {
      values.archivedAt = input.archived ? new Date() : null;
      changes.push(
        input.archived
          ? isNull(flashcardCollection.archivedAt)
          : isNotNull(flashcardCollection.archivedAt),
      );
    }
    await tx
      .update(flashcardCollection)
      .set(values)
      .where(
        and(
          eq(flashcardCollection.id, collectionId),
          eq(flashcardCollection.userId, userId),
          or(...changes),
        ),
      );
    const collection = await getFlashcardCollection(tx, userId, collectionId);
    return collection ? { kind: "ok" as const, collection } : { kind: "not-found" as const };
  });

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
    const cards = await tx
      .select({ id: flashcard.id })
      .from(flashcard)
      .where(eq(flashcard.collectionId, collectionId))
      .for("update");
    if (cards.length)
      await deleteCards(
        tx,
        userId,
        cards.map(({ id }) => id),
      );
    await tx.delete(flashcardCollection).where(eq(flashcardCollection.id, collectionId));
    return true;
  });
