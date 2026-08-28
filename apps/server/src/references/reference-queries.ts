import {
  collectReferenceSourceIds,
  getReferenceSourcePreview,
  REFERENCE_MAX_PER_TARGET,
  removeSourceAnchors,
  type CreateReferencesInput,
  type DocumentBlock,
  type ReferenceListQuery,
} from "@lazuli/shared";
import { and, asc, count, eq, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { Database } from "../database/client.ts";
import {
  document,
  flashcard,
  flashcardCollection,
  project,
  projectItem,
  quizCollection,
  quizQuestion,
  studyMaterialReference,
  userStorage,
} from "../database/schema/index.ts";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

const referenceSelection = {
  id: studyMaterialReference.id,
  documentId: studyMaterialReference.documentId,
  anchorId: studyMaterialReference.anchorId,
  flashcardId: studyMaterialReference.flashcardId,
  quizQuestionId: studyMaterialReference.quizQuestionId,
  createdAt: studyMaterialReference.createdAt,
  projectId: project.id,
  projectTitle: project.title,
  documentTitle: projectItem.title,
  flashcardCollectionId: flashcard.collectionId,
  flashcardCollectionTitle: flashcardCollection.title,
  flashcardPreview: flashcard.questionText,
  flashcardArchivedAt: flashcard.archivedAt,
  quizCollectionId: quizQuestion.collectionId,
  quizCollectionTitle: quizCollection.title,
  quizPreview: quizQuestion.contentText,
  quizArchivedAt: quizQuestion.archivedAt,
};

const referenceBaseQuery = (db: Executor) =>
  db
    .select(referenceSelection)
    .from(studyMaterialReference)
    .innerJoin(document, eq(document.id, studyMaterialReference.documentId))
    .innerJoin(projectItem, eq(projectItem.id, document.id))
    .innerJoin(project, eq(project.id, projectItem.projectId))
    .leftJoin(flashcard, eq(flashcard.id, studyMaterialReference.flashcardId))
    .leftJoin(flashcardCollection, eq(flashcardCollection.id, flashcard.collectionId))
    .leftJoin(quizQuestion, eq(quizQuestion.id, studyMaterialReference.quizQuestionId))
    .leftJoin(quizCollection, eq(quizCollection.id, quizQuestion.collectionId));

const serializeReference = (
  row: Awaited<ReturnType<typeof referenceBaseQuery>>[number],
  sourcePreview: string | null = null,
) => ({
  id: row.id,
  projectId: row.projectId,
  projectTitle: row.projectTitle,
  documentId: row.documentId,
  documentTitle: row.documentTitle,
  anchorId: row.anchorId,
  sourcePreview,
  material: row.flashcardId
    ? {
        type: "flashcard" as const,
        id: row.flashcardId,
        collectionId: row.flashcardCollectionId!,
        collectionTitle: row.flashcardCollectionTitle!,
        preview: row.flashcardPreview ?? "",
        archived: Boolean(row.flashcardArchivedAt),
      }
    : {
        type: "quizQuestion" as const,
        id: row.quizQuestionId!,
        collectionId: row.quizCollectionId!,
        collectionTitle: row.quizCollectionTitle!,
        preview: row.quizPreview ?? "",
        archived: Boolean(row.quizArchivedAt),
      },
  createdAt: row.createdAt.toISOString(),
});

const referenceWhere = (userId: string, input: ReferenceListQuery) =>
  and(
    eq(studyMaterialReference.userId, userId),
    input.documentId ? eq(studyMaterialReference.documentId, input.documentId) : undefined,
    input.anchorId ? eq(studyMaterialReference.anchorId, input.anchorId) : undefined,
    input.targetType === "flashcard" && input.targetId
      ? eq(studyMaterialReference.flashcardId, input.targetId)
      : input.targetType === "quizQuestion" && input.targetId
        ? eq(studyMaterialReference.quizQuestionId, input.targetId)
        : undefined,
  );

export const listReferences = async (db: Database, userId: string, input: ReferenceListQuery) => {
  const where = referenceWhere(userId, input);
  const [[total], rows] = await Promise.all([
    db
      .select({ value: count().mapWith(Number) })
      .from(studyMaterialReference)
      .where(where),
    referenceBaseQuery(db)
      .where(where)
      .orderBy(asc(studyMaterialReference.createdAt), asc(studyMaterialReference.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
  ]);
  const totalItems = total?.value ?? 0;
  const sourcePreviews = new Map<string, string>();
  if (input.targetId && rows.length) {
    const documentIds = [...new Set(rows.map(({ documentId }) => documentId))];
    const documents = await db
      .select({ id: document.id, content: document.content })
      .from(document)
      .where(inArray(document.id, documentIds));
    const contentByDocument = new Map(documents.map((item) => [item.id, item.content]));
    for (const row of rows) {
      const content = contentByDocument.get(row.documentId);
      if (content)
        sourcePreviews.set(
          row.id,
          getReferenceSourcePreview(content as DocumentBlock[], row.anchorId),
        );
    }
  }
  return {
    items: rows.map((row) => serializeReference(row, sourcePreviews.get(row.id) ?? null)),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: totalItems ? Math.ceil(totalItems / input.pageSize) : 0,
    },
  };
};

const getOwnedDocument = async (tx: Transaction, userId: string, documentId: string) => {
  const [row] = await tx
    .select({ content: document.content })
    .from(document)
    .innerJoin(projectItem, eq(projectItem.id, document.id))
    .innerJoin(project, eq(project.id, projectItem.projectId))
    .where(and(eq(document.id, documentId), eq(project.userId, userId)))
    .limit(1);
  return row ?? null;
};

const validateTargets = async (
  tx: Transaction,
  userId: string,
  targets: CreateReferencesInput["targets"],
) => {
  const flashcardIds = targets.filter(({ type }) => type === "flashcard").map(({ id }) => id);
  const quizQuestionIds = targets.filter(({ type }) => type === "quizQuestion").map(({ id }) => id);
  const [cards, questions, referenceCounts] = await Promise.all([
    flashcardIds.length
      ? tx
          .select({ id: flashcard.id })
          .from(flashcard)
          .innerJoin(flashcardCollection, eq(flashcardCollection.id, flashcard.collectionId))
          .where(
            and(
              inArray(flashcard.id, flashcardIds),
              eq(flashcardCollection.userId, userId),
              isNull(flashcard.archivedAt),
            ),
          )
      : [],
    quizQuestionIds.length
      ? tx
          .select({ id: quizQuestion.id })
          .from(quizQuestion)
          .innerJoin(quizCollection, eq(quizCollection.id, quizQuestion.collectionId))
          .where(
            and(
              inArray(quizQuestion.id, quizQuestionIds),
              eq(quizCollection.userId, userId),
              isNull(quizQuestion.archivedAt),
            ),
          )
      : [],
    tx
      .select({
        flashcardId: studyMaterialReference.flashcardId,
        quizQuestionId: studyMaterialReference.quizQuestionId,
        value: count().mapWith(Number),
      })
      .from(studyMaterialReference)
      .where(
        and(
          eq(studyMaterialReference.userId, userId),
          or(
            flashcardIds.length
              ? inArray(studyMaterialReference.flashcardId, flashcardIds)
              : undefined,
            quizQuestionIds.length
              ? inArray(studyMaterialReference.quizQuestionId, quizQuestionIds)
              : undefined,
          ),
        ),
      )
      .groupBy(studyMaterialReference.flashcardId, studyMaterialReference.quizQuestionId),
  ]);
  if (cards.length !== flashcardIds.length || questions.length !== quizQuestionIds.length)
    return "not-found" as const;
  if (referenceCounts.some(({ value }) => value >= REFERENCE_MAX_PER_TARGET))
    return "limit" as const;
  return "ok" as const;
};

export const createReferences = async (
  db: Database,
  userId: string,
  input: CreateReferencesInput,
) =>
  db.transaction(async (tx) => {
    const ownedDocument = await getOwnedDocument(tx, userId, input.source.documentId);
    if (!ownedDocument) return { kind: "not-found" as const };
    if (
      input.source.type === "selection" &&
      !collectReferenceSourceIds(ownedDocument.content as DocumentBlock[]).has(
        input.source.anchorId,
      )
    )
      return { kind: "anchor-not-found" as const };
    const targetValidation = await validateTargets(tx, userId, input.targets);
    if (targetValidation !== "ok") return { kind: targetValidation };
    const values = input.targets.map((target) => ({
      id: randomUUID(),
      userId,
      documentId: input.source.documentId,
      anchorId: input.source.type === "selection" ? input.source.anchorId : null,
      flashcardId: target.type === "flashcard" ? target.id : null,
      quizQuestionId: target.type === "quizQuestion" ? target.id : null,
    }));
    const inserted = await tx
      .insert(studyMaterialReference)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: studyMaterialReference.id });
    const targetWhere = or(
      ...input.targets.map((target) =>
        target.type === "flashcard"
          ? eq(studyMaterialReference.flashcardId, target.id)
          : eq(studyMaterialReference.quizQuestionId, target.id),
      ),
    );
    const rows = await referenceBaseQuery(tx)
      .where(
        and(
          eq(studyMaterialReference.userId, userId),
          eq(studyMaterialReference.documentId, input.source.documentId),
          input.source.type === "selection"
            ? eq(studyMaterialReference.anchorId, input.source.anchorId)
            : isNull(studyMaterialReference.anchorId),
          targetWhere,
        ),
      )
      .orderBy(asc(studyMaterialReference.createdAt), asc(studyMaterialReference.id));
    return {
      kind: "ok" as const,
      created: inserted.length,
      items: rows.map((row) => serializeReference(row)),
    };
  });

export const reconcileDocumentReferences = async (
  tx: Transaction,
  userId: string,
  documentId: string,
  content: DocumentBlock[],
) => {
  const anchors = [...collectReferenceSourceIds(content)];
  const removed = await tx
    .delete(studyMaterialReference)
    .where(
      and(
        eq(studyMaterialReference.userId, userId),
        eq(studyMaterialReference.documentId, documentId),
        isNotNull(studyMaterialReference.anchorId),
        anchors.length ? notInArray(studyMaterialReference.anchorId, anchors) : undefined,
      ),
    )
    .returning({ id: studyMaterialReference.id });
  return removed.length;
};

export const deleteReferencesForTargets = async (
  tx: Transaction,
  userId: string,
  targets: { flashcardIds?: string[]; quizQuestionIds?: string[] },
) => {
  const conditions = [
    targets.flashcardIds?.length
      ? inArray(studyMaterialReference.flashcardId, targets.flashcardIds)
      : undefined,
    targets.quizQuestionIds?.length
      ? inArray(studyMaterialReference.quizQuestionId, targets.quizQuestionIds)
      : undefined,
  ].filter((condition) => condition !== undefined);
  if (!conditions.length) return;
  const removed = await tx
    .delete(studyMaterialReference)
    .where(
      and(
        eq(studyMaterialReference.userId, userId),
        or(...conditions),
        isNotNull(studyMaterialReference.anchorId),
      ),
    )
    .returning({
      documentId: studyMaterialReference.documentId,
      anchorId: studyMaterialReference.anchorId,
    });
  const candidates = new Map<string, Set<string>>();
  for (const { anchorId, documentId } of removed) {
    if (!anchorId) continue;
    const anchors = candidates.get(documentId) ?? new Set<string>();
    anchors.add(anchorId);
    candidates.set(documentId, anchors);
  }
  if (!candidates.size) return;
  const documentIds = [...candidates.keys()];
  const remaining = await tx
    .select({
      documentId: studyMaterialReference.documentId,
      anchorId: studyMaterialReference.anchorId,
    })
    .from(studyMaterialReference)
    .where(
      and(
        inArray(studyMaterialReference.documentId, documentIds),
        isNotNull(studyMaterialReference.anchorId),
      ),
    );
  for (const { anchorId, documentId } of remaining)
    if (anchorId) candidates.get(documentId)?.delete(anchorId);
  const storedDocuments = await tx
    .select({
      id: document.id,
      content: document.content,
      contentByteSize: document.contentByteSize,
    })
    .from(document)
    .where(inArray(document.id, documentIds))
    .for("update", { of: document });
  let storageDelta = 0;
  const now = new Date();
  for (const stored of storedDocuments) {
    const anchors = candidates.get(stored.id);
    if (!anchors?.size) continue;
    const stripped = removeSourceAnchors(stored.content as DocumentBlock[], anchors);
    if (!stripped.changed) continue;
    const contentByteSize = Buffer.byteLength(JSON.stringify(stripped.content));
    storageDelta += contentByteSize - stored.contentByteSize;
    await tx
      .update(document)
      .set({
        content: stripped.content,
        contentByteSize,
        revision: sql`${document.revision} + 1`,
        updatedAt: now,
      })
      .where(eq(document.id, stored.id));
    await tx.update(projectItem).set({ updatedAt: now }).where(eq(projectItem.id, stored.id));
  }
  if (!storageDelta) return;
  await tx.insert(userStorage).values({ userId }).onConflictDoNothing();
  await tx
    .update(userStorage)
    .set({
      usedBytes: sql`greatest(0, ${userStorage.usedBytes} + ${storageDelta})`,
      updatedAt: now,
    })
    .where(eq(userStorage.userId, userId));
};

export const deleteReference = async (db: Database, userId: string, referenceId: string) =>
  db.transaction(async (tx) => {
    const [reference] = await tx
      .select({
        id: studyMaterialReference.id,
        documentId: studyMaterialReference.documentId,
        anchorId: studyMaterialReference.anchorId,
      })
      .from(studyMaterialReference)
      .where(
        and(eq(studyMaterialReference.id, referenceId), eq(studyMaterialReference.userId, userId)),
      )
      .limit(1)
      .for("update");
    if (!reference) return { kind: "not-found" as const };
    await tx.delete(studyMaterialReference).where(eq(studyMaterialReference.id, reference.id));
    if (!reference.anchorId) return { kind: "ok" as const };
    const [remaining] = await tx
      .select({ value: count().mapWith(Number) })
      .from(studyMaterialReference)
      .where(
        and(
          eq(studyMaterialReference.documentId, reference.documentId),
          eq(studyMaterialReference.anchorId, reference.anchorId),
        ),
      );
    if ((remaining?.value ?? 0) > 0) return { kind: "ok" as const };
    const [stored] = await tx
      .select({
        content: document.content,
        contentByteSize: document.contentByteSize,
        projectId: projectItem.projectId,
      })
      .from(document)
      .innerJoin(projectItem, eq(projectItem.id, document.id))
      .where(eq(document.id, reference.documentId))
      .limit(1)
      .for("update", { of: document });
    if (!stored) return { kind: "ok" as const };
    const stripped = removeSourceAnchors(
      stored.content as DocumentBlock[],
      new Set([reference.anchorId]),
    );
    if (!stripped.changed) return { kind: "ok" as const };
    const contentByteSize = Buffer.byteLength(JSON.stringify(stripped.content));
    const storageDelta = contentByteSize - stored.contentByteSize;
    const now = new Date();
    await tx
      .update(document)
      .set({
        content: stripped.content,
        contentByteSize,
        revision: sql`${document.revision} + 1`,
        updatedAt: now,
      })
      .where(eq(document.id, reference.documentId));
    await tx
      .update(projectItem)
      .set({ updatedAt: now })
      .where(eq(projectItem.id, reference.documentId));
    await tx.insert(userStorage).values({ userId }).onConflictDoNothing();
    await tx
      .update(userStorage)
      .set({
        usedBytes: sql`greatest(0, ${userStorage.usedBytes} + ${storageDelta})`,
        updatedAt: now,
      })
      .where(eq(userStorage.userId, userId));
    return { kind: "ok" as const };
  });
