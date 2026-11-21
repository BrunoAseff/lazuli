import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { Database, QueryExecutor } from "../database/client.ts";
import {
  asset,
  quizAttempt,
  quizAttemptAsset,
  quizCollection,
  quizQuestion,
} from "../database/schema/index.ts";
import { releaseStoredObjects } from "../storage/storage-cleanup.ts";
import { deleteReferencesForTargets } from "../references/reference-queries.ts";
import {
  createStudyCollectionQueries,
  type StudyCollectionRow,
} from "../study-collections/study-collection-queries.ts";

const enrichCollections = async (
  database: QueryExecutor,
  userId: string,
  rows: StudyCollectionRow[],
) => {
  if (rows.length === 0) return [];
  const collectionIds = rows.map(({ id }) => id);
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
      lastScore,
      bestScoreRate: attempts?.bestScoreRate ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
};

const quizCollectionQueries = createStudyCollectionQueries({
  enrich: (database, userId, rows) => enrichCollections(database, userId, rows),
  favoriteKind: "quizzes",
  table: quizCollection,
});

export const listQuizCollections = quizCollectionQueries.list;
export const getQuizCollection = quizCollectionQueries.get;
export const createQuizCollection = quizCollectionQueries.create;
export const updateQuizCollection = quizCollectionQueries.update;

export const deleteQuizCollection = async (
  database: Database,
  userId: string,
  collectionId: string,
) =>
  database.transaction(async (tx) => {
    const ownedQuestions = await tx
      .select({ id: quizQuestion.id })
      .from(quizQuestion)
      .innerJoin(quizCollection, eq(quizCollection.id, quizQuestion.collectionId))
      .where(and(eq(quizCollection.id, collectionId), eq(quizCollection.userId, userId)));
    await deleteReferencesForTargets(tx, userId, {
      quizQuestionIds: ownedQuestions.map(({ id }) => id),
    });
    const questionAssets = await tx
      .select({ byteSize: asset.byteSize, id: asset.id, objectKey: asset.objectKey })
      .from(asset)
      .innerJoin(quizQuestion, eq(quizQuestion.id, asset.quizQuestionId))
      .innerJoin(quizCollection, eq(quizCollection.id, quizQuestion.collectionId))
      .where(and(eq(quizCollection.id, collectionId), eq(quizCollection.userId, userId)))
      .for("update", { of: asset });
    const attemptAssets = await tx
      .select({ byteSize: asset.byteSize, id: asset.id, objectKey: asset.objectKey })
      .from(asset)
      .innerJoin(quizAttemptAsset, eq(quizAttemptAsset.assetId, asset.id))
      .innerJoin(quizAttempt, eq(quizAttempt.id, quizAttemptAsset.attemptId))
      .where(and(eq(quizAttempt.collectionId, collectionId), eq(quizAttempt.userId, userId)))
      .for("update", { of: asset });
    const ownedAssets = [
      ...new Map([...questionAssets, ...attemptAssets].map((item) => [item.id, item])).values(),
    ];
    const [deleted] = await tx
      .delete(quizCollection)
      .where(and(eq(quizCollection.id, collectionId), eq(quizCollection.userId, userId)))
      .returning({ id: quizCollection.id });
    if (!deleted) return false;
    if (ownedAssets.length) {
      await releaseStoredObjects(tx, userId, ownedAssets);
      await tx.delete(asset).where(
        inArray(
          asset.id,
          ownedAssets.map(({ id }) => id),
        ),
      );
    }
    return true;
  });
