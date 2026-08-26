import type {
  CreateQuizCollectionInput,
  QuizCollectionListQuery,
  UpdateQuizCollectionInput,
} from "@lazuli/shared";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { escapeLikePattern } from "../database/sql-search.ts";
import { project, quizAttempt, quizCollection, quizQuestion } from "../database/schema/index.ts";
import { ownsProject } from "../projects/project-ownership.ts";

const collectionSelection = {
  id: quizCollection.id,
  title: quizCollection.title,
  projectId: project.id,
  projectTitle: project.title,
  archivedAt: quizCollection.archivedAt,
  createdAt: quizCollection.createdAt,
  updatedAt: quizCollection.updatedAt,
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

const enrichCollections = async (
  database: QueryExecutor,
  userId: string,
  rows: CollectionRow[],
  now: Date,
) => {
  if (rows.length === 0) return [];
  const collectionIds = rows.map(({ id }) => id);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
  const [questionMetrics, attemptMetrics, lastAttempts] = await Promise.all([
    database
      .select({ collectionId: quizQuestion.collectionId, totalQuestions: count().mapWith(Number) })
      .from(quizQuestion)
      .where(
        and(inArray(quizQuestion.collectionId, collectionIds), isNull(quizQuestion.archivedAt)),
      )
      .groupBy(quizQuestion.collectionId),
    database
      .select({
        collectionId: quizAttempt.collectionId,
        totalAttempts: count().mapWith(Number),
        attemptsLastSevenDays:
          sql<number>`count(*) filter (where ${gte(quizAttempt.completedAt, weekStart)})`.mapWith(
            Number,
          ),
        bestScoreRate: sql<
          number | null
        >`max(${quizAttempt.correctAnswers}::double precision / nullif(${quizAttempt.totalQuestions}, 0))`.mapWith(
          Number,
        ),
      })
      .from(quizAttempt)
      .where(
        and(
          inArray(quizAttempt.collectionId, collectionIds),
          eq(quizAttempt.userId, userId),
          eq(quizAttempt.status, "completed"),
        ),
      )
      .groupBy(quizAttempt.collectionId),
    database
      .selectDistinctOn([quizAttempt.collectionId], {
        collectionId: quizAttempt.collectionId,
        correctAnswers: quizAttempt.correctAnswers,
        totalQuestions: quizAttempt.totalQuestions,
        completedAt: quizAttempt.completedAt,
      })
      .from(quizAttempt)
      .where(
        and(
          inArray(quizAttempt.collectionId, collectionIds),
          eq(quizAttempt.userId, userId),
          eq(quizAttempt.status, "completed"),
          isNotNull(quizAttempt.completedAt),
        ),
      )
      .orderBy(quizAttempt.collectionId, desc(quizAttempt.completedAt), desc(quizAttempt.id)),
  ]);
  const questionsByCollection = new Map(
    questionMetrics.map((item) => [item.collectionId, item.totalQuestions]),
  );
  const attemptsByCollection = new Map(attemptMetrics.map((item) => [item.collectionId, item]));
  const lastByCollection = new Map(lastAttempts.map((item) => [item.collectionId, item]));

  return rows.map((row) => {
    const attempts = attemptsByCollection.get(row.id);
    const last = lastByCollection.get(row.id);
    const lastScore =
      last && last.totalQuestions > 0
        ? {
            correctAnswers: last.correctAnswers,
            totalQuestions: last.totalQuestions,
            rate: last.correctAnswers / last.totalQuestions,
          }
        : null;
    return {
      id: row.id,
      title: row.title,
      project:
        row.projectId && row.projectTitle ? { id: row.projectId, title: row.projectTitle } : null,
      archivedAt: row.archivedAt,
      totalQuestions: questionsByCollection.get(row.id) ?? 0,
      totalAttempts: attempts?.totalAttempts ?? 0,
      attemptsLastSevenDays: attempts?.attemptsLastSevenDays ?? 0,
      lastScore,
      bestScoreRate: attempts?.bestScoreRate ?? null,
      lastAttemptAt: last?.completedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
};

const createCollectionWhere = (userId: string, input: QuizCollectionListQuery) =>
  and(
    eq(quizCollection.userId, userId),
    input.status === "active"
      ? isNull(quizCollection.archivedAt)
      : isNotNull(quizCollection.archivedAt),
    input.project === "none"
      ? isNull(quizCollection.projectId)
      : input.project
        ? eq(quizCollection.projectId, input.project)
        : undefined,
    input.query
      ? sql<boolean>`unaccent(lower(${quizCollection.title})) LIKE unaccent(lower(${`%${escapeLikePattern(input.query)}%`})) ESCAPE ${"\\"}`
      : undefined,
  );

export const listQuizCollections = async (
  database: Database,
  userId: string,
  input: QuizCollectionListQuery,
  now = new Date(),
) => {
  const where = createCollectionWhere(userId, input);
  const [total, rows] = await Promise.all([
    database.select({ value: count() }).from(quizCollection).where(where),
    database
      .select(collectionSelection)
      .from(quizCollection)
      .leftJoin(project, and(eq(project.id, quizCollection.projectId), eq(project.userId, userId)))
      .where(where)
      .orderBy(desc(quizCollection.createdAt), desc(quizCollection.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
  ]);
  const totalItems = total[0]?.value ?? 0;
  return {
    items: await enrichCollections(database, userId, rows, now),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
    },
  };
};

export const getQuizCollection = async (
  database: QueryExecutor,
  userId: string,
  collectionId: string,
  now = new Date(),
) => {
  const [row] = await database
    .select(collectionSelection)
    .from(quizCollection)
    .leftJoin(project, and(eq(project.id, quizCollection.projectId), eq(project.userId, userId)))
    .where(and(eq(quizCollection.id, collectionId), eq(quizCollection.userId, userId)))
    .limit(1);
  if (!row) return null;
  return (await enrichCollections(database, userId, [row], now))[0] ?? null;
};

export const createQuizCollection = async (
  database: Database,
  userId: string,
  input: CreateQuizCollectionInput,
) =>
  database.transaction(async (tx) => {
    if (input.projectId && !(await ownsProject(tx, userId, input.projectId)))
      return { kind: "project-not-found" as const };
    const [inserted] = await tx
      .insert(quizCollection)
      .values({ ...input, userId })
      .onConflictDoNothing({ target: quizCollection.id })
      .returning({ id: quizCollection.id });
    if (inserted)
      return {
        kind: "ok" as const,
        created: true,
        collection: await getQuizCollection(tx, userId, inserted.id),
      };
    const existing = await getQuizCollection(tx, userId, input.id);
    if (
      !existing ||
      existing.title !== input.title ||
      (existing.project?.id ?? null) !== input.projectId ||
      existing.archivedAt !== null
    )
      return { kind: "conflict" as const };
    return { kind: "ok" as const, created: false, collection: existing };
  });

export const updateQuizCollection = async (
  database: Database,
  userId: string,
  collectionId: string,
  input: UpdateQuizCollectionInput,
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
      changes.push(sql`${quizCollection.title} is distinct from ${input.title}`);
    }
    if (input.projectId !== undefined) {
      values.projectId = input.projectId;
      changes.push(sql`${quizCollection.projectId} is distinct from ${input.projectId}`);
    }
    if (input.archived !== undefined) {
      values.archivedAt = input.archived ? new Date() : null;
      changes.push(
        input.archived ? isNull(quizCollection.archivedAt) : isNotNull(quizCollection.archivedAt),
      );
    }
    await tx
      .update(quizCollection)
      .set(values)
      .where(
        and(eq(quizCollection.id, collectionId), eq(quizCollection.userId, userId), or(...changes)),
      );
    const collection = await getQuizCollection(tx, userId, collectionId);
    return collection ? { kind: "ok" as const, collection } : { kind: "not-found" as const };
  });

export const deleteQuizCollection = async (
  database: Database,
  userId: string,
  collectionId: string,
) =>
  database.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(quizCollection)
      .where(and(eq(quizCollection.id, collectionId), eq(quizCollection.userId, userId)))
      .returning({ id: quizCollection.id });
    return Boolean(deleted);
  });
