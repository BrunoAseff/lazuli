import {
  aiCollectionDraftSchema,
  aiSelectionDraftSchema,
  addSourceAnchorToQuote,
  AI_DOCUMENT_MAX_BLOCKS,
  AI_DOCUMENT_MAX_TEXT_LENGTH,
  collectDocumentTextBlocks,
  getDocumentBlockText,
  getReferenceSourcePreview,
  removeSourceAnchors,
  STORAGE_BASIC_LIMIT_BYTES,
  type ApproveAiSelectionGenerationInput,
  type CreateAiCollectionGenerationInput,
  type CreateAiSelectionGenerationInput,
  type DocumentBlock,
} from "@lazuli/shared";
import { and, desc, eq, or, sql } from "drizzle-orm";
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
import { createPersistedQuizOptions } from "./ai-persistence.ts";

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

const findBlock = (content: DocumentBlock[], blockId: string) => {
  const pending = [...content];
  while (pending.length) {
    const block = pending.shift()!;
    if (block.id === blockId) return block;
    if (block.children) pending.unshift(...block.children);
  }
  return null;
};

const flattenBlocks = (content: DocumentBlock[]) => {
  const result: DocumentBlock[] = [];
  const visit = (blocks: DocumentBlock[]) => {
    for (const block of blocks) {
      result.push(block);
      if (block.children?.length) visit(block.children);
    }
  };
  visit(content);
  return result;
};

const buildSelectionContext = ({
  content,
  documentTitle,
  projectTitle,
  sourceBlockIds,
}: {
  content: DocumentBlock[];
  documentTitle: string;
  projectTitle: string;
  sourceBlockIds: string[];
}) => {
  const sourceIds = new Set(sourceBlockIds);
  const blocks = flattenBlocks(content);
  const sourceIndexes = blocks.flatMap((block, index) => (sourceIds.has(block.id) ? [index] : []));
  const firstIndex = sourceIndexes[0] ?? -1;
  const lastIndex = sourceIndexes.at(-1) ?? firstIndex;
  const toSourceBlock = (block: DocumentBlock) => ({
    id: block.id,
    text: normalize(getDocumentBlockText(block)),
  });
  const nearby = (start: number, end: number) =>
    blocks
      .slice(Math.max(0, start), Math.max(0, end))
      .filter((block) => !sourceIds.has(block.id))
      .map(toSourceBlock)
      .filter(({ text }) => Boolean(text));
  const sectionBlock =
    firstIndex > 0
      ? blocks.slice(0, firstIndex).findLast((block) => block.type === "heading")
      : undefined;
  const sectionTitle = sectionBlock ? normalize(getDocumentBlockText(sectionBlock)) : undefined;
  return {
    after: lastIndex >= 0 ? nearby(lastIndex + 1, lastIndex + 3) : [],
    before: firstIndex >= 0 ? nearby(firstIndex - 2, firstIndex) : [],
    documentTitle,
    projectTitle,
    ...(sectionTitle ? { sectionTitle } : {}),
  };
};

const assetIdFromUrl = (value: unknown) =>
  typeof value === "string" ? value.match(/^\/api\/assets\/([^/]+)\/content$/)?.[1] : undefined;

export const getAiDocumentSourceMetadata = async (
  db: Database,
  userId: string,
  documentId: string,
) => {
  const [source] = await db
    .select({
      documentTitle: projectItem.title,
      projectId: project.id,
      projectTitle: project.title,
    })
    .from(document)
    .innerJoin(projectItem, eq(projectItem.id, document.id))
    .innerJoin(project, eq(project.id, projectItem.projectId))
    .where(and(eq(document.id, documentId), eq(project.userId, userId)))
    .limit(1);
  return source ?? null;
};

export const prepareAiSelectionGeneration = async (
  db: Database,
  userId: string,
  input: CreateAiSelectionGenerationInput,
) => {
  const [ownedDocument] = await db
    .select({
      content: document.content,
      documentTitle: projectItem.title,
      projectId: project.id,
      projectTitle: project.title,
      revision: document.revision,
    })
    .from(document)
    .innerJoin(projectItem, eq(projectItem.id, document.id))
    .innerJoin(project, eq(project.id, projectItem.projectId))
    .where(and(eq(document.id, input.documentId), eq(project.userId, userId)))
    .limit(1);
  if (!ownedDocument) return { kind: "not-found" as const };
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
    if (!sourceText) return { kind: "not-found" as const };
    if (blocks.length > AI_DOCUMENT_MAX_BLOCKS || sourceText.length > AI_DOCUMENT_MAX_TEXT_LENGTH)
      return { kind: "source-too-large" as const };
    return {
      kind: "ok" as const,
      blocks,
      context: buildSelectionContext({
        content,
        documentTitle: ownedDocument.documentTitle,
        projectTitle: ownedDocument.projectTitle,
        sourceBlockIds: blocks.map(({ id }) => id),
      }),
      documentTitle: ownedDocument.documentTitle,
      documentRevision: ownedDocument.revision,
      projectId: ownedDocument.projectId,
      projectTitle: ownedDocument.projectTitle,
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
    if (!block || block.type !== "image" || !assetId) return { kind: "not-found" as const };
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
    if (!ownedAsset) return { kind: "not-found" as const };
    const label =
      (typeof blockProps?.caption === "string" && normalize(blockProps.caption)) ||
      (typeof blockProps?.name === "string" && normalize(blockProps.name)) ||
      "Imagem selecionada";
    return {
      kind: "ok" as const,
      blocks: [{ id: block.id, text: label }],
      context: buildSelectionContext({
        content,
        documentTitle: ownedDocument.documentTitle,
        projectTitle: ownedDocument.projectTitle,
        sourceBlockIds: [block.id],
      }),
      documentTitle: ownedDocument.documentTitle,
      documentRevision: ownedDocument.revision,
      imageAsset: ownedAsset,
      selectedText: label,
      projectId: ownedDocument.projectId,
      projectTitle: ownedDocument.projectTitle,
      sourceBlockIds: [block.id],
    };
  }
  const selectedText = normalize(input.selectedText);
  const selectedPreview =
    normalize(input.selectedPreview) === selectedText ? input.selectedPreview.trim() : selectedText;
  const requestedBlocks = findBlocks(content, new Set(input.sourceBlockIds));
  const selectedTextLower = selectedText.toLocaleLowerCase("pt-BR");
  const requestedSourceText = normalize(
    input.sourceBlockIds
      .flatMap((id) => {
        const block = requestedBlocks.get(id);
        return block ? [getDocumentBlockText(block)] : [];
      })
      .join(" "),
  );
  const currentTextBlocks = collectDocumentTextBlocks(content);
  const matchingBlocks = requestedSourceText.toLocaleLowerCase("pt-BR").includes(selectedTextLower)
    ? input.sourceBlockIds.filter((id) => requestedBlocks.has(id))
    : currentTextBlocks
        .filter(({ text }) =>
          normalize(text).toLocaleLowerCase("pt-BR").includes(selectedTextLower),
        )
        .map(({ id }) => id);
  const sourceBlockIds = matchingBlocks.length ? matchingBlocks : input.sourceBlockIds;
  return {
    kind: "ok" as const,
    // The model receives only the exact user selection. Block IDs remain useful
    // for rebuilding a precise reference, but a stale autosave snapshot must not
    // prevent generation.
    blocks: [{ id: sourceBlockIds[0]!, text: selectedPreview }],
    context: buildSelectionContext({
      content,
      documentTitle: ownedDocument.documentTitle,
      projectTitle: ownedDocument.projectTitle,
      sourceBlockIds,
    }),
    documentTitle: ownedDocument.documentTitle,
    documentRevision: ownedDocument.revision,
    projectId: ownedDocument.projectId,
    projectTitle: ownedDocument.projectTitle,
    selectedText,
    sourceBlockIds,
  };
};

export const prepareAiCollectionGeneration = async (
  db: Database,
  userId: string,
  input: CreateAiCollectionGenerationInput,
) => {
  const [ownedDocument] = await db
    .select({
      content: document.content,
      documentTitle: projectItem.title,
      projectId: project.id,
      projectTitle: project.title,
      revision: document.revision,
    })
    .from(document)
    .innerJoin(projectItem, eq(projectItem.id, document.id))
    .innerJoin(project, eq(project.id, projectItem.projectId))
    .where(and(eq(document.id, input.documentId), eq(project.userId, userId)))
    .limit(1);
  if (!ownedDocument) return { kind: "not-found" as const };
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
  let blocks = input.sourceBlockIds.length
    ? (() => {
        const found = findBlocks(content, new Set(input.sourceBlockIds));
        return input.sourceBlockIds
          .map((id) => found.get(id))
          .filter((block): block is DocumentBlock => Boolean(block))
          .map((block) => ({ id: block.id, text: normalize(getDocumentBlockText(block)) }))
          .filter(({ text }) => Boolean(text));
      })()
    : collectDocumentTextBlocks(content);
  if (
    !blocks.length ||
    (input.sourceBlockIds.length && blocks.length !== input.sourceBlockIds.length)
  )
    blocks = collectDocumentTextBlocks(content);
  if (!blocks.length) return { kind: "not-found" as const };
  const sourceText = normalize(blocks.map(({ text }) => text).join(" "));
  if (blocks.length > AI_DOCUMENT_MAX_BLOCKS || sourceText.length > AI_DOCUMENT_MAX_TEXT_LENGTH)
    return { kind: "source-too-large" as const };
  return {
    kind: "ok" as const,
    blocks,
    documentTitle: ownedDocument.documentTitle,
    documentRevision: ownedDocument.revision,
    projectId: ownedDocument.projectId,
    projectTitle: ownedDocument.projectTitle,
  };
};

export const approveAiSelectionGeneration = async (
  db: Database,
  userId: string,
  operationId: string,
  input: ApproveAiSelectionGenerationInput,
) =>
  db.transaction(async (tx) => {
    const [requestedOperation] = await tx
      .select()
      .from(aiGeneration)
      .where(and(eq(aiGeneration.id, operationId), eq(aiGeneration.userId, userId)))
      .limit(1);
    if (!requestedOperation) return { kind: "not-found" as const };
    const chainRootId = requestedOperation.regenerationOfId ?? requestedOperation.id;
    const chain = await tx
      .select()
      .from(aiGeneration)
      .where(
        and(
          eq(aiGeneration.userId, userId),
          or(eq(aiGeneration.id, chainRootId), eq(aiGeneration.regenerationOfId, chainRootId)),
        ),
      )
      .orderBy(aiGeneration.createdAt)
      .for("update");
    const operation = chain.find(({ id }) => id === operationId);
    if (
      !operation ||
      !["selection_generation", "collection_generation"].includes(operation.type) ||
      operation.status !== "succeeded"
    )
      return { kind: "not-found" as const };
    if (chain.some(({ approvedItems }) => approvedItems > 0))
      return { kind: "already-approved" as const };
    if (operation.expiresAt && operation.expiresAt <= new Date())
      return { kind: "expired" as const };
    const draftSchema =
      operation.type === "collection_generation" ? aiCollectionDraftSchema : aiSelectionDraftSchema;
    const draft = draftSchema.parse({
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
    const proposalById = new Map(
      (draft.kind === "flashcard" ? draft.flashcards : draft.quizQuestions).map((item) => [
        item.id,
        item,
      ]),
    );
    const submittedItems = draft.kind === "flashcard" ? input.flashcards : input.quizQuestions;

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
    // The database is authoritative. Browser revisions routinely lag behind
    // autosave, so approval rebuilds anchors over the current owned document
    // instead of rejecting an otherwise valid generation.
    let anchoredContent = ownedDocument.content as DocumentBlock[];
    const referenceAnchors = new Map<string, Array<string | null>>();
    let draftAnchorUsed = false;
    for (const item of submittedItems) {
      if (!item.references.length) continue;
      const proposal = proposalById.get(item.id);
      if (!proposal) return { kind: "invalid-items" as const };
      const originalReferences = new Set(
        proposal.references.map(({ blockId, quote }) => `${blockId}:${normalize(quote)}`),
      );
      const anchors: Array<string | null> = [];
      for (const reference of item.references) {
        if (reference.scope === "document") {
          anchors.push(null);
          continue;
        }
        const isUnchangedProposalReference = originalReferences.has(
          `${reference.blockId}:${normalize(reference.quote)}`,
        );
        const isOriginalSourceReference =
          (draft.sourceScope === "selection" || draft.sourceScope === "image") &&
          isUnchangedProposalReference;
        if (isOriginalSourceReference && draft.sourceScope === "selection" && draft.anchorId) {
          const anchoredText = normalize(
            getReferenceSourcePreview(anchoredContent, draft.anchorId, Number.MAX_SAFE_INTEGER),
          );
          if (!anchoredText) return { kind: "reference-unanchorable" as const, itemId: item.id };
          anchors.push(draft.anchorId);
          draftAnchorUsed = true;
          continue;
        }
        if (
          isOriginalSourceReference &&
          draft.sourceScope === "image" &&
          draft.anchorId &&
          findBlock(anchoredContent, draft.anchorId)?.type === "image"
        ) {
          anchors.push(draft.anchorId);
          draftAnchorUsed = true;
          continue;
        }
        if (!reference.blockId || !reference.quote) {
          anchors.push(null);
          continue;
        }
        const applied = addSourceAnchorToQuote(anchoredContent, {
          blockId: reference.blockId,
          quote: reference.quote,
          anchorId: randomUUID(),
        });
        if (applied.kind !== "ok" && (isUnchangedProposalReference || isOriginalSourceReference)) {
          // A generated document/section quote may overlap anchors owned by other
          // materials. Keep the approved material linked to its document instead
          // of making an untouched proposal impossible to save.
          anchors.push(null);
          continue;
        }
        if (applied.kind !== "ok")
          return { kind: "reference-unanchorable" as const, itemId: item.id };
        if (applied.anchorId === draft.anchorId) {
          const anchoredText = normalize(
            getReferenceSourcePreview(anchoredContent, draft.anchorId, Number.MAX_SAFE_INTEGER),
          );
          // A narrower edited passage must not silently keep the broader source anchor.
          // An exact match may safely keep the source anchor and must survive cleanup.
          if (anchoredText !== normalize(reference.quote))
            return { kind: "reference-unanchorable" as const, itemId: item.id };
          draftAnchorUsed = true;
        }
        anchoredContent = applied.content;
        anchors.push(applied.anchorId);
      }
      referenceAnchors.set(item.id, [...new Set(anchors)]);
    }
    if (draft.sourceScope === "selection" && draft.anchorId && !draftAnchorUsed) {
      const [sharedReference] = await tx
        .select({ id: studyMaterialReference.id })
        .from(studyMaterialReference)
        .where(
          and(
            eq(studyMaterialReference.userId, userId),
            eq(studyMaterialReference.documentId, draft.documentId),
            eq(studyMaterialReference.anchorId, draft.anchorId),
          ),
        )
        .limit(1);
      if (!sharedReference)
        anchoredContent = removeSourceAnchors(anchoredContent, new Set([draft.anchorId])).content;
    }
    const contentByteSize = Buffer.byteLength(JSON.stringify(anchoredContent));
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
    if (!isDeepStrictEqual(ownedDocument.content, anchoredContent)) {
      const [saved] = await tx
        .update(document)
        .set({
          content: anchoredContent,
          contentByteSize,
          revision: sql`${document.revision} + 1`,
          updatedAt: now,
        })
        .where(eq(document.id, draft.documentId))
        .returning({ revision: document.revision });
      if (!saved) return { kind: "not-found" as const };
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
        await tx.insert(quizOption).values(createPersistedQuizOptions(item.id, item.options));
        position += 1;
      }
    }

    const references = submittedIds.flatMap((id) =>
      (referenceAnchors.get(id) ?? []).map((anchorId) => ({
        id: randomUUID(),
        userId,
        documentId: draft.documentId,
        anchorId,
        flashcardId: draft.kind === "flashcard" ? id : null,
        quizQuestionId: draft.kind === "quizQuestion" ? id : null,
      })),
    );
    if (references.length) await tx.insert(studyMaterialReference).values(references);

    await tx
      .update(aiGeneration)
      .set({ approvedItems: submittedIds.length })
      .where(eq(aiGeneration.id, operation.id));
    return { kind: "ok" as const, createdIds: submittedIds, revision };
  });
