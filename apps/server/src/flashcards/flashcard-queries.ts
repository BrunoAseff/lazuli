import type {
  CreateFlashcardInput,
  FlashcardBatchInput,
  FlashcardListQuery,
  ImportFlashcardsInput,
  UpdateFlashcardInput,
} from "@lazuli/shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { escapeLikePattern } from "../database/sql-search.ts";
import { asset, flashcard, flashcardCollection, userStorage } from "../database/schema/index.ts";
import { enqueueObjectDeletions } from "../storage/storage-cleanup.ts";
import { plainTextFlashcardContent } from "./flashcard-import.ts";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

const selection = {
  id: flashcard.id,
  collectionId: flashcard.collectionId,
  question: flashcard.question,
  answer: flashcard.answer,
  questionText: flashcard.questionText,
  answerText: flashcard.answerText,
  contentSchemaVersion: flashcard.contentSchemaVersion,
  srsState: flashcard.srsState,
  dueAt: flashcard.dueAt,
  lastReviewedAt: flashcard.lastReviewedAt,
  archivedAt: flashcard.archivedAt,
  createdAt: flashcard.createdAt,
  updatedAt: flashcard.updatedAt,
  questionHasImage: sql<boolean>`jsonb_path_exists(${flashcard.question}, '$.** ? (@.type == "image")')`,
  answerHasImage: sql<boolean>`jsonb_path_exists(${flashcard.answer}, '$.** ? (@.type == "image")')`,
};

type RichBlock = {
  type?: unknown;
  props?: Record<string, unknown>;
  content?: Array<
    { type: "text"; text: string } | { type: "link"; content: Array<{ text: string }> }
  >;
  children?: RichBlock[];
};

export const summarizeFlashcardContent = (content: unknown[]) => {
  const text: string[] = [];
  const assetIds = new Set<string>();
  const pending = [...(content as RichBlock[])];
  let hasImage = false;
  while (pending.length) {
    const block = pending.shift()!;
    if (block.type === "image") {
      hasImage = true;
      const url = block.props?.url;
      if (typeof url === "string") {
        const match = /^\/api\/assets\/([0-9a-f-]{36})\/content$/i.exec(url);
        if (match?.[1]) assetIds.add(match[1]);
      }
    }
    for (const item of block.content ?? []) {
      if (item.type === "text") text.push(item.text);
      else text.push(...item.content.map(({ text: value }) => value));
    }
    if (block.children) pending.unshift(...block.children);
  }
  return { assetIds: [...assetIds], hasImage, text: text.join(" ").replace(/\s+/g, " ").trim() };
};

const serializeRow = <T extends Record<string, unknown>>(row: T) => ({
  ...row,
  questionHasImage: Boolean(row.questionHasImage),
  answerHasImage: Boolean(row.answerHasImage),
});

const ownedCollection = async (db: Executor, userId: string, collectionId: string) => {
  const [row] = await db
    .select({ archivedAt: flashcardCollection.archivedAt, id: flashcardCollection.id })
    .from(flashcardCollection)
    .where(and(eq(flashcardCollection.id, collectionId), eq(flashcardCollection.userId, userId)))
    .limit(1);
  return row ?? null;
};

const cardWhere = (userId: string, collectionId: string, input: FlashcardListQuery, now: Date) =>
  and(
    eq(flashcard.collectionId, collectionId),
    eq(flashcardCollection.userId, userId),
    input.status === "active" ? isNull(flashcard.archivedAt) : isNotNull(flashcard.archivedAt),
    input.filter === "new"
      ? eq(flashcard.srsState, "new")
      : input.filter === "due"
        ? lte(flashcard.dueAt, now)
        : input.filter === "scheduled"
          ? gt(flashcard.dueAt, now)
          : undefined,
    input.query
      ? or(
          sql<boolean>`unaccent(lower(${flashcard.questionText})) LIKE unaccent(lower(${`%${escapeLikePattern(input.query)}%`})) ESCAPE ${"\\"}`,
          sql<boolean>`unaccent(lower(${flashcard.answerText})) LIKE unaccent(lower(${`%${escapeLikePattern(input.query)}%`})) ESCAPE ${"\\"}`,
        )
      : undefined,
  );

export const listFlashcards = async (
  db: Database,
  userId: string,
  collectionId: string,
  input: FlashcardListQuery,
  now = new Date(),
) => {
  if (!(await ownedCollection(db, userId, collectionId))) return null;
  const where = cardWhere(userId, collectionId, input, now);
  const order =
    input.sort === "created"
      ? [desc(flashcard.createdAt), desc(flashcard.id)]
      : input.sort === "due"
        ? [asc(flashcard.dueAt), asc(flashcard.id)]
        : [desc(flashcard.updatedAt), desc(flashcard.id)];
  const [[total], rows] = await Promise.all([
    db
      .select({ value: count().mapWith(Number) })
      .from(flashcard)
      .innerJoin(flashcardCollection, eq(flashcardCollection.id, flashcard.collectionId))
      .where(where),
    db
      .select({
        id: flashcard.id,
        collectionId: flashcard.collectionId,
        questionText: flashcard.questionText,
        answerText: flashcard.answerText,
        questionHasImage: selection.questionHasImage,
        answerHasImage: selection.answerHasImage,
        srsState: flashcard.srsState,
        dueAt: flashcard.dueAt,
        lastReviewedAt: flashcard.lastReviewedAt,
        archivedAt: flashcard.archivedAt,
        createdAt: flashcard.createdAt,
        updatedAt: flashcard.updatedAt,
      })
      .from(flashcard)
      .innerJoin(flashcardCollection, eq(flashcardCollection.id, flashcard.collectionId))
      .where(where)
      .orderBy(...order)
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
  ]);
  const totalItems = total?.value ?? 0;
  return {
    items: rows.map(serializeRow),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: totalItems ? Math.ceil(totalItems / input.pageSize) : 0,
    },
  };
};

export const getFlashcard = async (
  db: Executor,
  userId: string,
  collectionId: string,
  cardId: string,
) => {
  const [row] = await db
    .select(selection)
    .from(flashcard)
    .innerJoin(flashcardCollection, eq(flashcardCollection.id, flashcard.collectionId))
    .where(
      and(
        eq(flashcard.id, cardId),
        eq(flashcard.collectionId, collectionId),
        eq(flashcardCollection.userId, userId),
      ),
    )
    .limit(1);
  return row ? serializeRow(row) : null;
};

const lockOwnedCard = async (
  tx: Transaction,
  userId: string,
  collectionId: string,
  cardId: string,
) => {
  const [row] = await tx
    .select({ id: flashcard.id })
    .from(flashcard)
    .innerJoin(flashcardCollection, eq(flashcardCollection.id, flashcard.collectionId))
    .where(
      and(
        eq(flashcard.id, cardId),
        eq(flashcard.collectionId, collectionId),
        eq(flashcardCollection.userId, userId),
      ),
    )
    .limit(1)
    .for("update", { of: flashcard });
  return Boolean(row);
};

const attachAssets = async (
  tx: Transaction,
  userId: string,
  cardId: string,
  assetIds: string[],
) => {
  if (!assetIds.length) return true;
  const owned = await tx
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        eq(asset.userId, userId),
        inArray(asset.id, assetIds),
        or(isNull(asset.flashcardId), eq(asset.flashcardId, cardId)),
        isNull(asset.documentId),
        isNull(asset.projectId),
      ),
    )
    .for("update");
  if (owned.length !== assetIds.length) return false;
  await tx
    .update(asset)
    .set({ attachedAt: new Date(), flashcardId: cardId })
    .where(inArray(asset.id, assetIds));
  return true;
};

const releaseRemovedAssets = async (
  tx: Transaction,
  userId: string,
  cardId: string,
  retainedIds: string[],
) => {
  const current = await tx
    .select({ byteSize: asset.byteSize, id: asset.id, objectKey: asset.objectKey })
    .from(asset)
    .where(
      and(
        eq(asset.userId, userId),
        eq(asset.flashcardId, cardId),
        retainedIds.length ? notInArray(asset.id, retainedIds) : undefined,
      ),
    )
    .for("update");
  if (!current.length) return;
  await enqueueObjectDeletions(
    tx,
    current.map(({ objectKey }) => objectKey),
  );
  await tx.delete(asset).where(
    inArray(
      asset.id,
      current.map(({ id }) => id),
    ),
  );
  const bytes = current.reduce((sum, item) => sum + item.byteSize, 0);
  await tx
    .update(userStorage)
    .set({
      usedBytes: sql`greatest(0, ${userStorage.usedBytes} - ${bytes})`,
      updatedAt: new Date(),
    })
    .where(eq(userStorage.userId, userId));
};

export const createFlashcard = async (
  db: Database,
  userId: string,
  collectionId: string,
  input: CreateFlashcardInput,
) =>
  db.transaction(async (tx) => {
    const collection = await ownedCollection(tx, userId, collectionId);
    if (!collection || collection.archivedAt) return { kind: "not-found" as const };
    const question = summarizeFlashcardContent(input.question);
    const answer = summarizeFlashcardContent(input.answer);
    const assetIds = [...new Set([...question.assetIds, ...answer.assetIds])];
    const [created] = await tx
      .insert(flashcard)
      .values({
        id: input.id,
        collectionId,
        question: input.question,
        answer: input.answer,
        questionText: question.text,
        answerText: answer.text,
      })
      .onConflictDoNothing({ target: flashcard.id })
      .returning({ id: flashcard.id });
    if (!created) {
      const existing = await getFlashcard(tx, userId, collectionId, input.id);
      if (
        !existing ||
        JSON.stringify(existing.question) !== JSON.stringify(input.question) ||
        JSON.stringify(existing.answer) !== JSON.stringify(input.answer)
      )
        return { kind: "conflict" as const };
      return { kind: "ok" as const, card: existing, created: false };
    }
    if (!(await attachAssets(tx, userId, input.id, assetIds))) {
      await tx.delete(flashcard).where(eq(flashcard.id, input.id));
      return { kind: "invalid-assets" as const };
    }
    return {
      kind: "ok" as const,
      card: await getFlashcard(tx, userId, collectionId, input.id),
      created: true,
    };
  });

export const importFlashcards = async (
  db: Database,
  userId: string,
  collectionId: string,
  input: ImportFlashcardsInput,
) =>
  db.transaction(async (tx) => {
    const collection = await ownedCollection(tx, userId, collectionId);
    if (!collection || collection.archivedAt) return { kind: "not-found" as const };
    const ids = input.cards.map(({ id }) => id);
    const existing = await tx
      .select({ id: flashcard.id })
      .from(flashcard)
      .where(inArray(flashcard.id, ids));
    if (existing.length) return { kind: "conflict" as const };
    const inserted = await tx
      .insert(flashcard)
      .values(
        input.cards.map(({ answer, id, question }) => ({
          id,
          collectionId,
          question: plainTextFlashcardContent(question),
          answer: plainTextFlashcardContent(answer),
          questionText: question.replace(/\s+/g, " ").trim(),
          answerText: answer.replace(/\s+/g, " ").trim(),
        })),
      )
      .onConflictDoNothing({ target: flashcard.id })
      .returning({ id: flashcard.id });
    if (inserted.length !== input.cards.length) {
      if (inserted.length)
        await tx.delete(flashcard).where(
          inArray(
            flashcard.id,
            inserted.map(({ id }) => id),
          ),
        );
      return { kind: "conflict" as const };
    }
    return { kind: "ok" as const, imported: input.cards.length };
  });

export const updateFlashcard = async (
  db: Database,
  userId: string,
  collectionId: string,
  cardId: string,
  input: UpdateFlashcardInput,
) =>
  db.transaction(async (tx) => {
    if (!(await lockOwnedCard(tx, userId, collectionId, cardId)))
      return { kind: "not-found" as const };
    const current = await getFlashcard(tx, userId, collectionId, cardId);
    if (!current) return { kind: "not-found" as const };
    const targetCollectionId = input.collectionId ?? collectionId;
    const target = await ownedCollection(tx, userId, targetCollectionId);
    if (!target || target.archivedAt) return { kind: "collection-not-found" as const };
    const questionContent = input.question ?? current.question;
    const answerContent = input.answer ?? current.answer;
    const question = summarizeFlashcardContent(questionContent);
    const answer = summarizeFlashcardContent(answerContent);
    const assetIds = [...new Set([...question.assetIds, ...answer.assetIds])];
    const nextArchivedAt =
      input.archived === undefined ? current.archivedAt : input.archived ? new Date() : null;
    if (
      targetCollectionId === current.collectionId &&
      JSON.stringify(questionContent) === JSON.stringify(current.question) &&
      JSON.stringify(answerContent) === JSON.stringify(current.answer) &&
      (input.archived === undefined || Boolean(current.archivedAt) === input.archived)
    )
      return { kind: "ok" as const, card: current };
    if (!(await attachAssets(tx, userId, cardId, assetIds)))
      return { kind: "invalid-assets" as const };
    await tx
      .update(flashcard)
      .set({
        collectionId: targetCollectionId,
        question: questionContent,
        answer: answerContent,
        questionText: question.text,
        answerText: answer.text,
        archivedAt: nextArchivedAt,
        updatedAt: new Date(),
      })
      .where(eq(flashcard.id, cardId));
    await releaseRemovedAssets(tx, userId, cardId, assetIds);
    return {
      kind: "ok" as const,
      card: await getFlashcard(tx, userId, targetCollectionId, cardId),
    };
  });

export const deleteCards = async (tx: Transaction, userId: string, ids: string[]) => {
  const stored = await tx
    .select({ byteSize: asset.byteSize, objectKey: asset.objectKey })
    .from(asset)
    .where(and(eq(asset.userId, userId), inArray(asset.flashcardId, ids)))
    .for("update");
  if (stored.length) {
    await enqueueObjectDeletions(
      tx,
      stored.map(({ objectKey }) => objectKey),
    );
    const bytes = stored.reduce((sum, item) => sum + item.byteSize, 0);
    await tx
      .update(userStorage)
      .set({
        usedBytes: sql`greatest(0, ${userStorage.usedBytes} - ${bytes})`,
        updatedAt: new Date(),
      })
      .where(eq(userStorage.userId, userId));
  }
  await tx.delete(flashcard).where(inArray(flashcard.id, ids));
};

export const deleteFlashcard = async (
  db: Database,
  userId: string,
  collectionId: string,
  cardId: string,
) =>
  db.transaction(async (tx) => {
    if (!(await lockOwnedCard(tx, userId, collectionId, cardId))) return false;
    const current = await getFlashcard(tx, userId, collectionId, cardId);
    if (!current) return false;
    await deleteCards(tx, userId, [cardId]);
    return true;
  });

export const batchFlashcards = async (
  db: Database,
  userId: string,
  collectionId: string,
  input: FlashcardBatchInput,
) =>
  db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: flashcard.id })
      .from(flashcard)
      .innerJoin(flashcardCollection, eq(flashcardCollection.id, flashcard.collectionId))
      .where(
        and(
          eq(flashcard.collectionId, collectionId),
          eq(flashcardCollection.userId, userId),
          inArray(flashcard.id, input.ids),
        ),
      )
      .for("update", { of: flashcard });
    if (rows.length !== input.ids.length) return { kind: "not-found" as const };
    if (input.action.type === "delete") await deleteCards(tx, userId, input.ids);
    else if (input.action.type === "move") {
      const target = await ownedCollection(tx, userId, input.action.collectionId);
      if (!target || target.archivedAt) return { kind: "collection-not-found" as const };
      await tx
        .update(flashcard)
        .set({ collectionId: input.action.collectionId, updatedAt: new Date() })
        .where(inArray(flashcard.id, input.ids));
    } else
      await tx
        .update(flashcard)
        .set({
          archivedAt: input.action.type === "archive" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(inArray(flashcard.id, input.ids));
    return { kind: "ok" as const, count: rows.length };
  });
