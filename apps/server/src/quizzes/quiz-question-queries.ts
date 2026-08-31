import type {
  CreateQuizQuestionInput,
  QuizQuestionListQuery,
  UpdateQuizQuestionInput,
} from "@lazuli/shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { escapeLikePattern } from "../database/sql-search.ts";
import {
  asset,
  quizAttemptAsset,
  quizCollection,
  quizOption,
  quizQuestion,
  userStorage,
} from "../database/schema/index.ts";
import { enqueueObjectDeletions } from "../storage/storage-cleanup.ts";
import { summarizeRichContent } from "../documents/rich-content-summary.ts";
import { deleteReferencesForTargets } from "../references/reference-queries.ts";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

const ownedCollection = async (db: Executor, userId: string, collectionId: string) => {
  const [row] = await db
    .select({ id: quizCollection.id, archivedAt: quizCollection.archivedAt })
    .from(quizCollection)
    .where(and(eq(quizCollection.id, collectionId), eq(quizCollection.userId, userId)))
    .limit(1);
  return row ?? null;
};

const attachAssets = async (
  tx: Transaction,
  userId: string,
  questionId: string,
  assetIds: string[],
) => {
  if (!assetIds.length) return true;
  const rows = await tx
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        eq(asset.userId, userId),
        inArray(asset.id, assetIds),
        or(isNull(asset.quizQuestionId), eq(asset.quizQuestionId, questionId)),
        isNull(asset.documentId),
        isNull(asset.projectId),
        isNull(asset.flashcardId),
      ),
    )
    .for("update");
  if (rows.length !== assetIds.length) return false;
  await tx
    .update(asset)
    .set({ attachedAt: new Date(), quizQuestionId: questionId })
    .where(inArray(asset.id, assetIds));
  return true;
};

const releaseAssets = async (
  tx: Transaction,
  userId: string,
  questionId: string,
  retained: string[],
) => {
  const rows = await tx
    .select({ id: asset.id, objectKey: asset.objectKey, byteSize: asset.byteSize })
    .from(asset)
    .where(
      and(
        eq(asset.userId, userId),
        eq(asset.quizQuestionId, questionId),
        retained.length ? notInArray(asset.id, retained) : undefined,
      ),
    )
    .for("update");
  if (!rows.length) return;
  const retainedByAttempt = await tx
    .select({ assetId: quizAttemptAsset.assetId })
    .from(quizAttemptAsset)
    .where(
      inArray(
        quizAttemptAsset.assetId,
        rows.map(({ id }) => id),
      ),
    );
  const retainedIds = new Set(retainedByAttempt.map(({ assetId }) => assetId));
  const removable = rows.filter(({ id }) => !retainedIds.has(id));
  const detached = rows.filter(({ id }) => retainedIds.has(id));
  if (detached.length)
    await tx
      .update(asset)
      .set({ quizQuestionId: null })
      .where(
        inArray(
          asset.id,
          detached.map(({ id }) => id),
        ),
      );
  if (!removable.length) return;
  await enqueueObjectDeletions(
    tx,
    removable.map(({ objectKey }) => objectKey),
  );
  await tx.delete(asset).where(
    inArray(
      asset.id,
      removable.map(({ id }) => id),
    ),
  );
  const bytes = removable.reduce((sum, item) => sum + item.byteSize, 0);
  await tx
    .update(userStorage)
    .set({
      usedBytes: sql`greatest(0, ${userStorage.usedBytes} - ${bytes})`,
      updatedAt: new Date(),
    })
    .where(eq(userStorage.userId, userId));
};

const summarySelection = {
  id: quizQuestion.id,
  collectionId: quizQuestion.collectionId,
  contentText: quizQuestion.contentText,
  hasImage: sql<boolean>`jsonb_path_exists(${quizQuestion.content}, '$.** ? (@.type == "image")')`,
  optionCount: count(quizOption.id).mapWith(Number),
  correctOptionText: sql<string>`coalesce(max(${quizOption.text}) filter (where ${quizOption.isCorrect}), '')`,
  position: quizQuestion.position,
  archivedAt: quizQuestion.archivedAt,
  createdAt: quizQuestion.createdAt,
  updatedAt: quizQuestion.updatedAt,
};

const serialize = <T extends Record<string, unknown>>(row: T) => ({
  ...row,
  hasImage: Boolean(row.hasImage),
});

export const listQuizQuestions = async (
  db: Database,
  userId: string,
  collectionId: string,
  input: QuizQuestionListQuery,
) => {
  if (!(await ownedCollection(db, userId, collectionId))) return null;
  const where = and(
    eq(quizQuestion.collectionId, collectionId),
    input.status === "active"
      ? isNull(quizQuestion.archivedAt)
      : isNotNull(quizQuestion.archivedAt),
    input.query
      ? sql<boolean>`unaccent(lower(${quizQuestion.contentText})) LIKE unaccent(lower(${`%${escapeLikePattern(input.query)}%`})) ESCAPE ${"\\"}`
      : undefined,
  );
  const order =
    input.sort === "created"
      ? [desc(quizQuestion.createdAt), desc(quizQuestion.id)]
      : input.sort === "position"
        ? [asc(quizQuestion.position), asc(quizQuestion.id)]
        : [desc(quizQuestion.updatedAt), desc(quizQuestion.id)];
  const [[total], rows] = await Promise.all([
    db
      .select({ value: count().mapWith(Number) })
      .from(quizQuestion)
      .where(where),
    db
      .select(summarySelection)
      .from(quizQuestion)
      .leftJoin(quizOption, eq(quizOption.questionId, quizQuestion.id))
      .where(where)
      .groupBy(quizQuestion.id)
      .orderBy(...order)
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
  ]);
  const totalItems = total?.value ?? 0;
  return {
    items: rows.map(serialize),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: totalItems ? Math.ceil(totalItems / input.pageSize) : 0,
    },
  };
};

export const getQuizQuestion = async (
  db: Executor,
  userId: string,
  collectionId: string,
  questionId: string,
) => {
  const [row] = await db
    .select({
      id: quizQuestion.id,
      collectionId: quizQuestion.collectionId,
      content: quizQuestion.content,
      contentText: quizQuestion.contentText,
      contentSchemaVersion: quizQuestion.contentSchemaVersion,
      position: quizQuestion.position,
      archivedAt: quizQuestion.archivedAt,
      createdAt: quizQuestion.createdAt,
      updatedAt: quizQuestion.updatedAt,
      hasImage: sql<boolean>`jsonb_path_exists(${quizQuestion.content}, '$.** ? (@.type == "image")')`,
    })
    .from(quizQuestion)
    .innerJoin(quizCollection, eq(quizCollection.id, quizQuestion.collectionId))
    .where(
      and(
        eq(quizQuestion.id, questionId),
        eq(quizQuestion.collectionId, collectionId),
        eq(quizCollection.userId, userId),
      ),
    )
    .limit(1);
  if (!row) return null;
  const options = await db
    .select({
      id: quizOption.id,
      text: quizOption.text,
      position: quizOption.position,
      isCorrect: quizOption.isCorrect,
    })
    .from(quizOption)
    .where(eq(quizOption.questionId, questionId))
    .orderBy(quizOption.position, quizOption.id);
  return serialize({
    ...row,
    optionCount: options.length,
    correctOptionText: options.find(({ isCorrect }) => isCorrect)?.text ?? "",
    options,
  });
};

export const createQuizQuestion = async (
  db: Database,
  userId: string,
  collectionId: string,
  input: CreateQuizQuestionInput,
) =>
  db.transaction(async (tx) => {
    const collection = await ownedCollection(tx, userId, collectionId);
    if (!collection || collection.archivedAt) return { kind: "not-found" as const };
    const content = summarizeRichContent(input.content);
    const [last] = await tx
      .select({ position: quizQuestion.position })
      .from(quizQuestion)
      .where(eq(quizQuestion.collectionId, collectionId))
      .orderBy(desc(quizQuestion.position))
      .limit(1)
      .for("update");
    const [created] = await tx
      .insert(quizQuestion)
      .values({
        id: input.id,
        collectionId,
        content: input.content,
        contentText: content.text,
        position: (last?.position ?? -1) + 1,
      })
      .onConflictDoNothing({ target: quizQuestion.id })
      .returning({ id: quizQuestion.id });
    if (!created) {
      const existing = await getQuizQuestion(tx, userId, collectionId, input.id);
      const same =
        existing &&
        JSON.stringify(existing.content) === JSON.stringify(input.content) &&
        JSON.stringify(
          existing.options.map(({ id, isCorrect, text }) => ({ id, isCorrect, text })),
        ) === JSON.stringify(input.options);
      return same
        ? { kind: "ok" as const, question: existing, created: false }
        : { kind: "conflict" as const };
    }
    await tx
      .insert(quizOption)
      .values(
        input.options.map((option, position) => ({ ...option, questionId: input.id, position })),
      );
    if (!(await attachAssets(tx, userId, input.id, content.assetIds))) {
      await tx.delete(quizQuestion).where(eq(quizQuestion.id, input.id));
      return { kind: "invalid-assets" as const };
    }
    return {
      kind: "ok" as const,
      question: await getQuizQuestion(tx, userId, collectionId, input.id),
      created: true,
    };
  });

export const updateQuizQuestion = async (
  db: Database,
  userId: string,
  collectionId: string,
  questionId: string,
  input: UpdateQuizQuestionInput,
) =>
  db.transaction(async (tx) => {
    const sourceCollection = await ownedCollection(tx, userId, collectionId);
    if (!sourceCollection || sourceCollection.archivedAt) return { kind: "not-found" as const };
    const [locked] = await tx
      .select({ id: quizQuestion.id })
      .from(quizQuestion)
      .where(and(eq(quizQuestion.id, questionId), eq(quizQuestion.collectionId, collectionId)))
      .limit(1)
      .for("update");
    if (!locked) return { kind: "not-found" as const };
    const existing = await getQuizQuestion(tx, userId, collectionId, questionId);
    if (!existing) return { kind: "not-found" as const };
    const targetId = input.collectionId ?? collectionId;
    let targetPosition: number | undefined;
    if (targetId !== collectionId) {
      const target = await ownedCollection(tx, userId, targetId);
      if (!target || target.archivedAt) return { kind: "collection-not-found" as const };
      const [last] = await tx
        .select({ position: quizQuestion.position })
        .from(quizQuestion)
        .where(eq(quizQuestion.collectionId, targetId))
        .orderBy(desc(quizQuestion.position))
        .limit(1)
        .for("update");
      targetPosition = (last?.position ?? -1) + 1;
    }
    const summary = input.content ? summarizeRichContent(input.content) : null;
    if (summary && !(await attachAssets(tx, userId, questionId, summary.assetIds)))
      return { kind: "invalid-assets" as const };
    await tx
      .update(quizQuestion)
      .set({
        ...(input.content && { content: input.content, contentText: summary!.text }),
        ...(input.collectionId && { collectionId: input.collectionId, position: targetPosition }),
        ...(input.archived !== undefined && { archivedAt: input.archived ? new Date() : null }),
        updatedAt: new Date(),
      })
      .where(eq(quizQuestion.id, questionId));
    if (input.options) {
      await tx.delete(quizOption).where(eq(quizOption.questionId, questionId));
      await tx
        .insert(quizOption)
        .values(input.options.map((option, position) => ({ ...option, questionId, position })));
    }
    if (summary) await releaseAssets(tx, userId, questionId, summary.assetIds);
    return {
      kind: "ok" as const,
      question: await getQuizQuestion(tx, userId, targetId, questionId),
    };
  });

export const deleteQuizQuestion = async (
  db: Database,
  userId: string,
  collectionId: string,
  questionId: string,
) =>
  db.transaction(async (tx) => {
    if (!(await getQuizQuestion(tx, userId, collectionId, questionId))) return false;
    await deleteReferencesForTargets(tx, userId, { quizQuestionIds: [questionId] });
    await releaseAssets(tx, userId, questionId, []);
    await tx.delete(quizQuestion).where(eq(quizQuestion.id, questionId));
    return true;
  });
