import {
  aiSelectionDraftSchema,
  AI_DOCUMENT_MAX_BLOCKS,
  AI_DOCUMENT_MAX_TEXT_LENGTH,
  collectDocumentTextBlocks,
  collectReferenceSourceIds,
  getDocumentBlockText,
  getReferenceSourcePreview,
  readSourceAnchorId,
  STORAGE_BASIC_LIMIT_BYTES,
  type ApproveAiSelectionGenerationInput,
  type CreateAiSelectionGenerationInput,
  type DocumentBlock,
} from "@lazuli/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";

import type { Database } from "../database/client.ts";
import {
  aiGeneration,
  asset,
  document,
  flashcard,
  flashcardCollection,
  project,
  projectItem,
  quizCollection,
  quizOption,
  quizQuestion,
  studyMaterialReference,
  userStorage,
} from "../database/schema/index.ts";
import { summarizeRichContent } from "../documents/rich-content-summary.ts";

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

const findBlocks = (content: DocumentBlock[], ids: Set<string>) => {
  const found = new Map<string, DocumentBlock>();
  const pending = [...content];
  while (pending.length) {
    const block = pending.shift()!;
    if (ids.has(block.id)) found.set(block.id, block);
    if (block.children) pending.unshift(...block.children);
  }
  return found;
};

const findAnchorBlockIds = (content: DocumentBlock[], anchorId: string) => {
  const blockIds = new Set<string>();
  const pending = [...content];
  while (pending.length) {
    const block = pending.pop()!;
    const containsAnchor = (block.content ?? []).some((item) => {
      const texts = item.type === "text" ? [item] : item.content;
      return texts.some((text) => readSourceAnchorId(text.styles) === anchorId);
    });
    if (containsAnchor) blockIds.add(block.id);
    if (block.children) pending.push(...block.children);
  }
  return blockIds;
};

const findBlock = (content: DocumentBlock[], blockId: string) => {
  const pending = [...content];
  while (pending.length) {
    const block = pending.shift()!;
    if (block.id === blockId) return block;
    if (block.children) pending.unshift(...block.children);
  }
  return null;
};

const assetIdFromUrl = (value: unknown) =>
  typeof value === "string" ? value.match(/^\/api\/assets\/([^/]+)\/content$/)?.[1] : undefined;

export const prepareAiSelectionGeneration = async (
  db: Database,
  userId: string,
  input: CreateAiSelectionGenerationInput,
) => {
  const [ownedDocument] = await db
    .select({ content: document.content, revision: document.revision })
    .from(document)
    .innerJoin(projectItem, eq(projectItem.id, document.id))
    .innerJoin(project, eq(project.id, projectItem.projectId))
    .where(and(eq(document.id, input.documentId), eq(project.userId, userId)))
    .limit(1);
  if (!ownedDocument) return { kind: "not-found" as const };
  if (ownedDocument.revision !== input.expectedRevision)
    return { kind: "conflict" as const, revision: ownedDocument.revision };
  const collectionTable = input.kind === "flashcard" ? flashcardCollection : quizCollection;
  const [collection] = await db
    .select({ id: collectionTable.id })
    .from(collectionTable)
    .where(
      and(
        eq(collectionTable.id, input.collectionId),
        eq(collectionTable.userId, userId),
        sql`${collectionTable.archivedAt} is null`,
      ),
    )
    .limit(1);
  if (!collection) return { kind: "collection-not-found" as const };
  const content = ownedDocument.content as DocumentBlock[];
  if (input.sourceScope === "document") {
    const blocks = collectDocumentTextBlocks(content);
    const sourceText = normalize(blocks.map(({ text }) => text).join(" "));
    if (!sourceText) return { kind: "source-changed" as const };
    if (blocks.length > AI_DOCUMENT_MAX_BLOCKS || sourceText.length > AI_DOCUMENT_MAX_TEXT_LENGTH)
      return { kind: "source-too-large" as const };
    return {
      kind: "ok" as const,
      blocks,
      documentRevision: ownedDocument.revision,
      selectedText: sourceText,
      sourceBlockIds: blocks.map(({ id }) => id),
    };
  }
  if (input.sourceScope === "image") {
    const block = findBlock(content, input.anchorId);
    const blockProps = block?.props as
      | { caption?: unknown; name?: unknown; url?: unknown }
      | undefined;
    const assetId = assetIdFromUrl(blockProps?.url);
    if (!block || block.type !== "image" || !assetId) return { kind: "source-changed" as const };
    const [ownedAsset] = await db
      .select({ mimeType: asset.mimeType, objectKey: asset.objectKey })
      .from(asset)
      .where(
        and(
          eq(asset.id, assetId),
          eq(asset.userId, userId),
          eq(asset.documentId, input.documentId),
        ),
      )
      .limit(1);
    if (!ownedAsset) return { kind: "source-changed" as const };
    const label =
      (typeof blockProps?.caption === "string" && normalize(blockProps.caption)) ||
      (typeof blockProps?.name === "string" && normalize(blockProps.name)) ||
      "Imagem selecionada";
    return {
      kind: "ok" as const,
      blocks: [{ id: block.id, text: label }],
      documentRevision: ownedDocument.revision,
      imageAsset: ownedAsset,
      selectedText: label,
      sourceBlockIds: [block.id],
    };
  }
  const blocks = findBlocks(content, new Set(input.sourceBlockIds));
  if (blocks.size !== input.sourceBlockIds.length) return { kind: "source-changed" as const };
  const sourceText = normalize(
    input.sourceBlockIds.map((id) => getDocumentBlockText(blocks.get(id)!)).join(" "),
  );
  if (
    !sourceText.toLocaleLowerCase("pt-BR").includes(input.selectedText.toLocaleLowerCase("pt-BR"))
  )
    return { kind: "source-changed" as const };
  return {
    kind: "ok" as const,
    // The model receives only the exact user selection. Whole touched blocks are
    // used exclusively to verify that the client did not invent the source.
    blocks: [{ id: input.sourceBlockIds[0]!, text: input.selectedText }],
    documentRevision: ownedDocument.revision,
    selectedText: input.selectedText,
    sourceBlockIds: input.sourceBlockIds,
  };
};

export const approveAiSelectionGeneration = async (
  db: Database,
  userId: string,
  operationId: string,
  input: ApproveAiSelectionGenerationInput,
) =>
  db.transaction(async (tx) => {
    const [operation] = await tx
      .select()
      .from(aiGeneration)
      .where(and(eq(aiGeneration.id, operationId), eq(aiGeneration.userId, userId)))
      .limit(1)
      .for("update");
    if (!operation || operation.type !== "selection_generation" || operation.status !== "succeeded")
      return { kind: "not-found" as const };
    if (operation.approvedItems > 0) return { kind: "already-approved" as const };
    if (operation.expiresAt && operation.expiresAt <= new Date())
      return { kind: "expired" as const };
    const draft = aiSelectionDraftSchema.parse({
      ...(operation.result as object),
      approved: false,
      consumedCredits: operation.consumedCredits,
    });
    if (
      (draft.kind === "flashcard" && input.quizQuestions.length) ||
      (draft.kind === "quizQuestion" && input.flashcards.length)
    )
      return { kind: "invalid-items" as const };
    const allowedIds = new Set(
      draft.kind === "flashcard"
        ? draft.flashcards.map(({ id }) => id)
        : draft.quizQuestions.map(({ id }) => id),
    );
    const submittedIds = [
      ...input.flashcards.map(({ id }) => id),
      ...input.quizQuestions.map(({ id }) => id),
    ];
    if (
      submittedIds.some((id) => !allowedIds.has(id)) ||
      new Set(submittedIds).size !== submittedIds.length
    )
      return { kind: "invalid-items" as const };

    const [ownedDocument] = await tx
      .select({
        content: document.content,
        contentByteSize: document.contentByteSize,
        projectId: projectItem.projectId,
        revision: document.revision,
      })
      .from(document)
      .innerJoin(projectItem, eq(projectItem.id, document.id))
      .innerJoin(project, eq(project.id, projectItem.projectId))
      .where(and(eq(document.id, draft.documentId), eq(project.userId, userId)))
      .limit(1)
      .for("update", { of: document });
    if (!ownedDocument) return { kind: "not-found" as const };
    if (
      ownedDocument.revision !== input.expectedRevision ||
      input.expectedRevision !== draft.documentRevision
    )
      return { kind: "conflict" as const, revision: ownedDocument.revision };
    if (draft.sourceScope === "selection") {
      if (
        !draft.anchorId ||
        !collectReferenceSourceIds(input.anchoredContent).has(draft.anchorId) ||
        normalize(getReferenceSourcePreview(input.anchoredContent, draft.anchorId, 12_001)) !==
          normalize(draft.sourceText)
      )
        return { kind: "source-changed" as const };
      const anchoredBlockIds = findAnchorBlockIds(input.anchoredContent, draft.anchorId);
      const allowedSourceBlockIds = new Set(draft.sourceBlockIds);
      if (
        anchoredBlockIds.size === 0 ||
        [...anchoredBlockIds].some((blockId) => !allowedSourceBlockIds.has(blockId))
      )
        return { kind: "source-changed" as const };
    } else if (draft.sourceScope === "image") {
      if (!isDeepStrictEqual(ownedDocument.content, input.anchoredContent))
        return { kind: "source-changed" as const };
      const image = draft.anchorId ? findBlock(input.anchoredContent, draft.anchorId) : null;
      if (!image || image.type !== "image") return { kind: "source-changed" as const };
    } else if (!isDeepStrictEqual(ownedDocument.content, input.anchoredContent))
      return { kind: "source-changed" as const };

    let firstQuizPosition = 0;
    if (draft.kind === "flashcard") {
      const [collection] = await tx
        .select({ id: flashcardCollection.id })
        .from(flashcardCollection)
        .where(
          and(
            eq(flashcardCollection.id, draft.collectionId),
            eq(flashcardCollection.userId, userId),
            sql`${flashcardCollection.archivedAt} is null`,
          ),
        )
        .limit(1)
        .for("update");
      if (!collection) return { kind: "collection-not-found" as const };
    } else {
      const [collection] = await tx
        .select({ id: quizCollection.id })
        .from(quizCollection)
        .where(
          and(
            eq(quizCollection.id, draft.collectionId),
            eq(quizCollection.userId, userId),
            sql`${quizCollection.archivedAt} is null`,
          ),
        )
        .limit(1)
        .for("update");
      if (!collection) return { kind: "collection-not-found" as const };
      const [last] = await tx
        .select({ position: quizQuestion.position })
        .from(quizQuestion)
        .where(eq(quizQuestion.collectionId, draft.collectionId))
        .orderBy(desc(quizQuestion.position))
        .limit(1)
        .for("update");
      firstQuizPosition = (last?.position ?? -1) + 1;
    }

    const now = new Date();
    const contentByteSize = Buffer.byteLength(JSON.stringify(input.anchoredContent));
    const storageDelta = contentByteSize - ownedDocument.contentByteSize;
    await tx.insert(userStorage).values({ userId }).onConflictDoNothing();
    const [usage] = await tx
      .select()
      .from(userStorage)
      .where(eq(userStorage.userId, userId))
      .for("update");
    if (
      storageDelta > 0 &&
      (!usage || usage.usedBytes + usage.reservedBytes + storageDelta > STORAGE_BASIC_LIMIT_BYTES)
    )
      return { kind: "quota" as const };
    let revision = ownedDocument.revision;
    if (
      draft.sourceScope === "selection" &&
      !isDeepStrictEqual(ownedDocument.content, input.anchoredContent)
    ) {
      const [saved] = await tx
        .update(document)
        .set({
          content: input.anchoredContent,
          contentByteSize,
          revision: sql`${document.revision} + 1`,
          updatedAt: now,
        })
        .where(
          and(eq(document.id, draft.documentId), eq(document.revision, input.expectedRevision)),
        )
        .returning({ revision: document.revision });
      if (!saved) return { kind: "conflict" as const, revision: ownedDocument.revision };
      revision = saved.revision;
      await tx
        .update(userStorage)
        .set({
          usedBytes: sql`greatest(0, ${userStorage.usedBytes} + ${storageDelta})`,
          updatedAt: now,
        })
        .where(eq(userStorage.userId, userId));
      await tx
        .update(projectItem)
        .set({ updatedAt: now })
        .where(eq(projectItem.id, draft.documentId));
    }

    if (draft.kind === "flashcard") {
      for (const item of input.flashcards) {
        const question = summarizeRichContent(item.question);
        const answer = summarizeRichContent(item.answer);
        await tx.insert(flashcard).values({
          id: item.id,
          collectionId: draft.collectionId,
          question: item.question,
          answer: item.answer,
          questionText: question.text,
          answerText: answer.text,
        });
      }
    } else {
      let position = firstQuizPosition;
      for (const item of input.quizQuestions) {
        const content = summarizeRichContent(item.content);
        await tx.insert(quizQuestion).values({
          id: item.id,
          collectionId: draft.collectionId,
          content: item.content,
          contentText: content.text,
          position,
        });
        await tx.insert(quizOption).values(
          item.options.map((option, optionPosition) => ({
            ...option,
            questionId: item.id,
            position: optionPosition,
          })),
        );
        position += 1;
      }
    }

    await tx.insert(studyMaterialReference).values(
      submittedIds.map((id) => ({
        id: randomUUID(),
        userId,
        documentId: draft.documentId,
        anchorId: draft.anchorId,
        flashcardId: draft.kind === "flashcard" ? id : null,
        quizQuestionId: draft.kind === "quizQuestion" ? id : null,
      })),
    );

    await tx
      .update(aiGeneration)
      .set({ approvedItems: submittedIds.length })
      .where(eq(aiGeneration.id, operation.id));
    return { kind: "ok" as const, createdIds: submittedIds, revision };
  });
