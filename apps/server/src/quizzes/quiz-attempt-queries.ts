import {
  QUIZ_ATTEMPT_MAX_QUESTIONS,
  type AnswerQuizAttemptItemInput,
  type CreateQuizAttemptInput,
} from "@lazuli/shared";
import { and, asc, count, eq, inArray, isNull, notExists, sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import {
  asset,
  quizAttempt,
  quizAttemptAsset,
  quizAttemptItem,
  quizCollection,
  quizOption,
  quizQuestion,
  studyMaterialReference,
  userStorage,
} from "../database/schema/index.ts";
import { summarizeRichContent } from "../documents/rich-content-summary.ts";
import { enqueueObjectDeletions } from "../storage/storage-cleanup.ts";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

const ownedAttempt = async (db: Executor, userId: string, attemptId: string) => {
  const [row] = await db
    .select({
      id: quizAttempt.id,
      collectionId: quizAttempt.collectionId,
      collectionTitle: quizCollection.title,
      status: quizAttempt.status,
      totalQuestions: quizAttempt.totalQuestions,
      answeredQuestions: quizAttempt.answeredQuestions,
      correctAnswers: quizAttempt.correctAnswers,
      startedAt: quizAttempt.startedAt,
      lastActivityAt: quizAttempt.lastActivityAt,
      completedAt: quizAttempt.completedAt,
    })
    .from(quizAttempt)
    .innerJoin(quizCollection, eq(quizCollection.id, quizAttempt.collectionId))
    .where(and(eq(quizAttempt.id, attemptId), eq(quizAttempt.userId, userId)))
    .limit(1);
  return row ?? null;
};

const lockOwnedAttempt = async (tx: Transaction, userId: string, attemptId: string) => {
  const [row] = await tx
    .select({ id: quizAttempt.id })
    .from(quizAttempt)
    .where(and(eq(quizAttempt.id, attemptId), eq(quizAttempt.userId, userId)))
    .limit(1)
    .for("update");
  return Boolean(row);
};

const releaseAbandonedAttemptContent = async (
  tx: Transaction,
  userId: string,
  attemptId: string,
) => {
  const retained = await tx
    .select({ assetId: quizAttemptAsset.assetId })
    .from(quizAttemptAsset)
    .where(eq(quizAttemptAsset.attemptId, attemptId));
  await tx.delete(quizAttemptItem).where(eq(quizAttemptItem.attemptId, attemptId));
  if (!retained.length) return;
  const assetIds = retained.map(({ assetId }) => assetId);
  await tx.delete(quizAttemptAsset).where(eq(quizAttemptAsset.attemptId, attemptId));
  const removable = await tx
    .select({ byteSize: asset.byteSize, id: asset.id, objectKey: asset.objectKey })
    .from(asset)
    .where(
      and(
        eq(asset.userId, userId),
        inArray(asset.id, assetIds),
        isNull(asset.quizQuestionId),
        notExists(
          tx
            .select({ assetId: quizAttemptAsset.assetId })
            .from(quizAttemptAsset)
            .where(eq(quizAttemptAsset.assetId, asset.id)),
        ),
      ),
    )
    .for("update");
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

export const getQuizAttempt = async (db: Executor, userId: string, attemptId: string) => {
  const attempt = await ownedAttempt(db, userId, attemptId);
  if (!attempt || attempt.status === "abandoned") return null;
  const rows = await db
    .select({
      id: quizAttemptItem.id,
      questionId: quizAttemptItem.questionId,
      referenceCount:
        sql<number>`(select count(*) from ${studyMaterialReference} where ${studyMaterialReference.quizQuestionId} = ${quizAttemptItem.questionId})`.mapWith(
          Number,
        ),
      position: quizAttemptItem.position,
      question: quizAttemptItem.question,
      options: quizAttemptItem.options,
      selectedOptionId: quizAttemptItem.selectedOptionId,
      correctOptionId: quizAttemptItem.correctOptionId,
      isCorrect: quizAttemptItem.isCorrect,
      answeredAt: quizAttemptItem.answeredAt,
    })
    .from(quizAttemptItem)
    .where(eq(quizAttemptItem.attemptId, attemptId))
    .orderBy(asc(quizAttemptItem.position), asc(quizAttemptItem.id));
  const base = {
    ...attempt,
    startedAt: attempt.startedAt.toISOString(),
    lastActivityAt: attempt.lastActivityAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString() ?? null,
  };
  if (attempt.status === "completed")
    return {
      ...base,
      status: "completed" as const,
      items: rows.map((row) => ({
        ...row,
        isCorrect: Boolean(row.isCorrect),
        answeredAt: row.answeredAt?.toISOString() ?? null,
      })),
    };
  return {
    ...base,
    status: "active" as const,
    items: rows.map(({ correctOptionId: _, isCorrect: __, ...row }) => ({
      ...row,
      answeredAt: row.answeredAt?.toISOString() ?? null,
    })),
  };
};

export const getQuizAttemptAvailability = async (
  db: Database,
  userId: string,
  collectionId: string,
) => {
  const [collection] = await db
    .select({ archivedAt: quizCollection.archivedAt })
    .from(quizCollection)
    .where(and(eq(quizCollection.id, collectionId), eq(quizCollection.userId, userId)))
    .limit(1);
  if (!collection) return null;
  const [[questionTotal], [active]] = await Promise.all([
    db
      .select({ value: count().mapWith(Number) })
      .from(quizQuestion)
      .where(and(eq(quizQuestion.collectionId, collectionId), isNull(quizQuestion.archivedAt))),
    db
      .select({ id: quizAttempt.id })
      .from(quizAttempt)
      .where(
        and(
          eq(quizAttempt.collectionId, collectionId),
          eq(quizAttempt.userId, userId),
          eq(quizAttempt.status, "active"),
        ),
      )
      .limit(1),
  ]);
  const activeAttempt = active ? await ownedAttempt(db, userId, active.id) : null;
  return {
    activeAttempt: activeAttempt
      ? {
          ...activeAttempt,
          status: "active" as const,
          startedAt: activeAttempt.startedAt.toISOString(),
          lastActivityAt: activeAttempt.lastActivityAt.toISOString(),
          completedAt: null,
        }
      : null,
    archived: Boolean(collection.archivedAt),
    totalQuestions: questionTotal?.value ?? 0,
  };
};

export const createQuizAttempt = async (
  db: Database,
  userId: string,
  collectionId: string,
  input: CreateQuizAttemptInput,
) =>
  db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ id: quizCollection.id, archivedAt: quizCollection.archivedAt })
      .from(quizCollection)
      .where(and(eq(quizCollection.id, collectionId), eq(quizCollection.userId, userId)))
      .limit(1)
      .for("update");
    if (!collection || collection.archivedAt) return { kind: "not-found" as const };
    const [active] = await tx
      .select({ id: quizAttempt.id })
      .from(quizAttempt)
      .where(
        and(
          eq(quizAttempt.userId, userId),
          eq(quizAttempt.collectionId, collectionId),
          eq(quizAttempt.status, "active"),
        ),
      )
      .limit(1)
      .for("update");
    if (active && !input.abandonActive)
      return {
        kind: "active-exists" as const,
        attempt: await getQuizAttempt(tx, userId, active.id),
      };
    if (active) {
      await tx
        .update(quizAttempt)
        .set({ status: "abandoned", updatedAt: new Date(), lastActivityAt: new Date() })
        .where(eq(quizAttempt.id, active.id));
      await releaseAbandonedAttemptContent(tx, userId, active.id);
    }
    const existing = await ownedAttempt(tx, userId, input.id);
    if (existing) return { kind: "conflict" as const };
    const questions = await tx
      .select({
        id: quizQuestion.id,
        content: quizQuestion.content,
        position: quizQuestion.position,
      })
      .from(quizQuestion)
      .where(and(eq(quizQuestion.collectionId, collectionId), isNull(quizQuestion.archivedAt)))
      .orderBy(asc(quizQuestion.position), asc(quizQuestion.id));
    if (!questions.length) return { kind: "empty" as const };
    if (questions.length > QUIZ_ATTEMPT_MAX_QUESTIONS) return { kind: "too-large" as const };
    const options = await tx
      .select({
        id: quizOption.id,
        questionId: quizOption.questionId,
        text: quizOption.text,
        position: quizOption.position,
        isCorrect: quizOption.isCorrect,
      })
      .from(quizOption)
      .where(
        inArray(
          quizOption.questionId,
          questions.map(({ id }) => id),
        ),
      )
      .orderBy(quizOption.questionId, quizOption.position, quizOption.id);
    const byQuestion = new Map<string, typeof options>();
    for (const option of options)
      byQuestion.set(option.questionId, [...(byQuestion.get(option.questionId) ?? []), option]);
    if (
      questions.some(({ id }) => {
        const values = byQuestion.get(id) ?? [];
        return (
          values.length < 2 ||
          values.length > 6 ||
          values.filter(({ isCorrect }) => isCorrect).length !== 1
        );
      })
    )
      return { kind: "invalid" as const };
    await tx
      .insert(quizAttempt)
      .values({ id: input.id, userId, collectionId, totalQuestions: questions.length });
    await tx.insert(quizAttemptItem).values(
      questions.map((question, position) => {
        const values = byQuestion.get(question.id)!;
        return {
          id: crypto.randomUUID(),
          attemptId: input.id,
          questionId: question.id,
          position,
          question: question.content,
          options: values.map(({ id, text, position: optionPosition }) => ({
            id,
            text,
            position: optionPosition,
          })),
          correctOptionId: values.find(({ isCorrect }) => isCorrect)!.id,
        };
      }),
    );
    const assetIds = [
      ...new Set(questions.flatMap(({ content }) => summarizeRichContent(content).assetIds)),
    ];
    if (assetIds.length) {
      const owned = await tx
        .select({ id: asset.id })
        .from(asset)
        .where(
          and(
            eq(asset.userId, userId),
            inArray(asset.id, assetIds),
            inArray(
              asset.quizQuestionId,
              questions.map(({ id }) => id),
            ),
          ),
        )
        .for("update");
      if (owned.length !== assetIds.length) {
        await tx.delete(quizAttempt).where(eq(quizAttempt.id, input.id));
        return { kind: "invalid" as const };
      }
      await tx
        .insert(quizAttemptAsset)
        .values(assetIds.map((assetId) => ({ attemptId: input.id, assetId })));
    }
    return { kind: "ok" as const, attempt: await getQuizAttempt(tx, userId, input.id) };
  });

export const answerQuizAttemptItem = async (
  db: Database,
  userId: string,
  attemptId: string,
  itemId: string,
  input: AnswerQuizAttemptItemInput,
) =>
  db.transaction(async (tx) => {
    if (!(await lockOwnedAttempt(tx, userId, attemptId))) return { kind: "not-found" as const };
    const attempt = await ownedAttempt(tx, userId, attemptId);
    if (!attempt) return { kind: "not-found" as const };
    if (attempt.status !== "active")
      return { kind: "closed" as const, attempt: await getQuizAttempt(tx, userId, attemptId) };
    const [item] = await tx
      .select({
        id: quizAttemptItem.id,
        options: quizAttemptItem.options,
        selectedOptionId: quizAttemptItem.selectedOptionId,
      })
      .from(quizAttemptItem)
      .where(and(eq(quizAttemptItem.id, itemId), eq(quizAttemptItem.attemptId, attemptId)))
      .limit(1)
      .for("update");
    if (!item) return { kind: "not-found" as const };
    if (!item.options.some(({ id }) => id === input.optionId))
      return { kind: "invalid-option" as const };
    const firstAnswer = item.selectedOptionId === null;
    const now = new Date();
    await tx
      .update(quizAttemptItem)
      .set({ selectedOptionId: input.optionId, answeredAt: now, updatedAt: now })
      .where(eq(quizAttemptItem.id, itemId));
    await tx
      .update(quizAttempt)
      .set({
        answeredQuestions: firstAnswer
          ? sql`${quizAttempt.answeredQuestions} + 1`
          : quizAttempt.answeredQuestions,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(quizAttempt.id, attemptId));
    return { kind: "ok" as const, attempt: await getQuizAttempt(tx, userId, attemptId) };
  });

export const completeQuizAttempt = async (db: Database, userId: string, attemptId: string) =>
  db.transaction(async (tx) => {
    if (!(await lockOwnedAttempt(tx, userId, attemptId))) return { kind: "not-found" as const };
    const attempt = await ownedAttempt(tx, userId, attemptId);
    if (!attempt) return { kind: "not-found" as const };
    if (attempt.status === "completed")
      return { kind: "ok" as const, attempt: await getQuizAttempt(tx, userId, attemptId) };
    if (attempt.status !== "active") return { kind: "closed" as const };
    const items = await tx
      .select({
        id: quizAttemptItem.id,
        selectedOptionId: quizAttemptItem.selectedOptionId,
        correctOptionId: quizAttemptItem.correctOptionId,
      })
      .from(quizAttemptItem)
      .where(eq(quizAttemptItem.attemptId, attemptId))
      .for("update");
    if (
      items.length !== attempt.totalQuestions ||
      items.some(({ selectedOptionId }) => !selectedOptionId)
    )
      return { kind: "incomplete" as const };
    const now = new Date();
    await tx
      .update(quizAttemptItem)
      .set({
        isCorrect: sql`${quizAttemptItem.selectedOptionId} = ${quizAttemptItem.correctOptionId}`,
        updatedAt: now,
      })
      .where(eq(quizAttemptItem.attemptId, attemptId));
    const correctAnswers = items.filter(
      (item) => item.selectedOptionId === item.correctOptionId,
    ).length;
    await tx
      .update(quizAttempt)
      .set({
        status: "completed",
        answeredQuestions: items.length,
        correctAnswers,
        completedAt: now,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(quizAttempt.id, attemptId));
    return { kind: "ok" as const, attempt: await getQuizAttempt(tx, userId, attemptId) };
  });

export const abandonQuizAttempt = async (db: Database, userId: string, attemptId: string) =>
  db.transaction(async (tx) => {
    if (!(await lockOwnedAttempt(tx, userId, attemptId))) return false;
    const attempt = await ownedAttempt(tx, userId, attemptId);
    if (!attempt) return false;
    if (attempt.status === "active")
      await tx
        .update(quizAttempt)
        .set({ status: "abandoned", lastActivityAt: new Date(), updatedAt: new Date() })
        .where(eq(quizAttempt.id, attemptId));
    if (attempt.status === "active") await releaseAbandonedAttemptContent(tx, userId, attemptId);
    return true;
  });
