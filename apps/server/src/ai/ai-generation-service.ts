import { createHash, randomUUID } from "node:crypto";
import {
  aiCollectionDraftSchema,
  aiMaterialImprovementDraftSchema,
  aiSelectionDraftSchema,
  type AiMaterialImprovementDraft,
  type AiImprovementIntent,
  type AiSelectionDraft,
} from "@lazuli/shared";

import type { Logger } from "pino";

import { AiGenerationError, aiErrorCodes, normalizeAiError } from "./ai-errors.ts";
import type { AiGenerationRecord, AiGenerationStore } from "./ai-generation-store.ts";
import {
  AI_DRAFT_TTL_MS,
  AI_MAX_CONTEXT_BLOCKS,
  AI_MAX_CONTEXT_BYTES,
  AI_MAX_OUTPUT_TOKENS,
  AI_MAX_SOURCE_IDS,
  estimateAiCostMicroUsd,
} from "./ai-model-config.ts";
import {
  COLLECTION_PROMPT_VERSION,
  createCollectionPrompt,
  createFoundationPrompt,
  createMaterialImprovementPrompt,
  createSelectionPrompt,
  type AiSourceBlock,
} from "./ai-prompts.ts";
import type { AiProvider } from "./ai-provider.ts";
import {
  countFoundationDraftItems,
  collectionProviderDraftSchema,
  foundationDraftSchema,
  flashcardImprovementProviderDraftSchema,
  quizImprovementProviderDraftSchema,
  selectionProviderDraftSchema,
  type FoundationDraft,
} from "./ai-schemas.ts";
import { estimateAiCredits } from "../ai-credits/ai-credit-config.ts";

type FoundationGenerationInput = {
  blocks: AiSourceBlock[];
  idempotencyKey: string;
  regenerateOperationId?: string;
  sourceIds: string[];
  userId: string;
};

type SelectionGenerationInput = {
  anchorId: string | null;
  blocks: AiSourceBlock[];
  collectionId: string;
  documentId: string;
  documentTitle?: string;
  documentRevision: number;
  guidance: string;
  idempotencyKey: string;
  images?: Array<{ data: Uint8Array; mediaType: string }>;
  kind: "flashcard" | "quizQuestion";
  quantity: number;
  projectId?: string;
  projectTitle?: string;
  regenerateOperationId?: string;
  selectedText: string;
  sourceScope: "selection" | "image" | "document";
  sourceBlockIds: string[];
  userId: string;
};

type MaterialImprovementInput = {
  collectionId: string;
  current: unknown;
  promptCurrent: unknown;
  guidance: string;
  idempotencyKey: string;
  intent: AiImprovementIntent;
  kind: "flashcard" | "quizQuestion";
  materialId: string;
  materialUpdatedAt: string;
  references: AiMaterialImprovementDraft["references"];
  regenerateOperationId?: string;
  sources: AiSourceBlock[];
  userId: string;
};

export type CollectionGenerationJob = {
  collectionId: string;
  documentId: string;
  documentTitle?: string;
  documentRevision: number;
  guidance: string;
  kind: "flashcard" | "quizQuestion";
  quantity: number;
  projectId?: string;
  projectTitle?: string;
  sourceBlockIds: string[];
  sourceScope: "document" | "section";
};

type CollectionGenerationInput = CollectionGenerationJob & {
  idempotencyKey: string;
  userId: string;
};

export type FoundationGenerationResult =
  | { draft: FoundationDraft; kind: "completed"; operationId: string; reused: boolean }
  | { kind: "in-progress"; operationId: string };

export type SelectionGenerationResult =
  | { draft: AiSelectionDraft; kind: "completed"; operationId: string; reused: boolean }
  | { kind: "in-progress"; operationId: string };

const pause = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });

const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const anonymousUserIdentifier = (userId: string) => `lazuli_${fingerprint(userId).slice(0, 32)}`;

const assertInputLimits = (input: FoundationGenerationInput) => {
  const byteSize = Buffer.byteLength(JSON.stringify(input.blocks), "utf8");
  if (
    input.blocks.length === 0 ||
    input.blocks.length > AI_MAX_CONTEXT_BLOCKS ||
    byteSize > AI_MAX_CONTEXT_BYTES ||
    input.sourceIds.length > AI_MAX_SOURCE_IDS
  )
    throw new AiGenerationError("AI_INPUT_TOO_LARGE");
};

const assertReferencedBlocksExist = (draft: FoundationDraft, blocks: AiSourceBlock[]) => {
  const allowedIds = new Set(blocks.map((block) => block.id));
  const references = [
    ...draft.flashcards.flatMap((item) => item.sourceBlockIds),
    ...draft.quizQuestions.flatMap((item) => item.sourceBlockIds),
  ];
  if (references.some((blockId) => !allowedIds.has(blockId)))
    throw new AiGenerationError("AI_INVALID_OUTPUT");
};

const normalizeEvidence = (value: string) => value.replace(/\s+/g, " ").trim();

const validatedReferences = (
  references: Array<{ blockId: string; quote: string }>,
  blocks: AiSourceBlock[],
) => {
  const sourceById = new Map(blocks.map((block) => [block.id, normalizeEvidence(block.text)]));
  const seen = new Set<string>();
  return references.filter(({ blockId, quote }) => {
    const source = sourceById.get(blockId);
    const normalizedQuote = normalizeEvidence(quote);
    const key = `${blockId}:${normalizedQuote}`;
    const firstMatch = source?.indexOf(normalizedQuote) ?? -1;
    if (
      !source ||
      !normalizedQuote ||
      firstMatch === -1 ||
      source.indexOf(normalizedQuote, firstMatch + 1) !== -1 ||
      seen.has(key)
    )
      return false;
    seen.add(key);
    return true;
  });
};

const proposalReferences = ({
  blocks,
  references,
  sourceScope,
  sourceText,
}: {
  blocks: AiSourceBlock[];
  references: Array<{ blockId: string; quote: string }>;
  sourceScope: "document" | "image" | "section" | "selection";
  sourceText: string;
}) => {
  if (sourceScope === "selection" || sourceScope === "image")
    return blocks[0] ? [{ blockId: blocks[0].id, quote: sourceText }] : [];
  return validatedReferences(references, blocks);
};

const withValidatedReferences = <
  T extends { references: Array<{ blockId: string; quote: string }> },
>(
  item: T,
  blocks: AiSourceBlock[],
) => {
  const references = validatedReferences(item.references, blocks);
  return {
    ...item,
    references,
    referenceWarning:
      references.length > 0
        ? null
        : "A referência sugerida não foi encontrada literalmente no documento.",
  };
};

const storedError = (errorCode: string | null) => {
  const code = aiErrorCodes.find((candidate) => candidate === errorCode);
  return new AiGenerationError(code ?? "AI_REQUEST_FAILED");
};

const parseStoredSelectionDraft = (operation: AiGenerationRecord) =>
  aiSelectionDraftSchema.parse({
    ...(operation.result as object),
    approved: operation.approvedItems > 0,
    consumedCredits: operation.consumedCredits,
  });

const parseStoredCollectionDraft = (operation: AiGenerationRecord) =>
  aiCollectionDraftSchema.parse({
    ...(operation.result as object),
    approved: operation.approvedItems > 0,
    consumedCredits: operation.consumedCredits,
  });

const parseStoredMaterialImprovementDraft = (operation: AiGenerationRecord) =>
  aiMaterialImprovementDraftSchema.parse({
    ...(operation.result as object),
    approved: operation.approvedItems > 0,
    consumedCredits: operation.consumedCredits,
  });

export const createAiGenerationService = ({
  logger,
  provider,
  retryDelayMs = 250,
  store,
}: {
  logger: Pick<Logger, "error" | "info" | "warn">;
  provider: AiProvider;
  retryDelayMs?: number;
  store: AiGenerationStore;
}) => {
  const getCollectionDraft = async (userId: string, operationId: string) => {
    const operation = await store.get(userId, operationId);
    if (!operation || operation.type !== "collection_generation") return null;
    if (operation.status === "running")
      return {
        kind: operation.leaseOwner ? ("processing" as const) : ("queued" as const),
        operationId: operation.id,
      };
    if (operation.status === "failed") throw storedError(operation.errorCode);
    return {
      draft: parseStoredCollectionDraft(operation),
      kind: "completed" as const,
      operationId: operation.id,
      reused: true,
    };
  };

  return {
    discardMaterialImprovementDraft: (userId: string, operationId: string) =>
      store.discardMaterialImprovement(userId, operationId),

    async getMaterialImprovementDraft(userId: string, operationId: string) {
      const operation = await store.get(userId, operationId);
      if (!operation || operation.type !== "material_improvement") return null;
      if (operation.status === "running")
        return { kind: "in-progress" as const, operationId: operation.id };
      if (operation.status === "failed") throw storedError(operation.errorCode);
      return {
        draft: parseStoredMaterialImprovementDraft(operation),
        kind: "completed" as const,
        operationId: operation.id,
        reused: true,
      };
    },

    async generateMaterialImprovementDraft(input: MaterialImprovementInput) {
      const prompt = createMaterialImprovementPrompt({
        current: input.promptCurrent,
        guidance: input.guidance,
        intent: input.intent,
        kind: input.kind,
        sources: input.sources,
      });
      const contextFingerprint = fingerprint({
        collectionId: input.collectionId,
        current: input.current,
        promptCurrent: input.promptCurrent,
        guidance: input.guidance,
        intent: input.intent,
        kind: input.kind,
        materialId: input.materialId,
        materialUpdatedAt: input.materialUpdatedAt,
        sources: input.sources,
      });
      const operationId = randomUUID();
      const admission = await store.begin({
        contextFingerprint,
        id: operationId,
        idempotencyKey: input.idempotencyKey,
        estimatedCredits: estimateAiCredits(1),
        origin: "material",
        promptVersion: prompt.promptVersion,
        provider: provider.name,
        requestedItems: 1,
        regenerationOfId: input.regenerateOperationId ?? null,
        requestedModel: provider.model,
        sourceIds: [input.materialId, ...input.references.map(({ documentId }) => documentId)],
        type: "material_improvement",
        userId: input.userId,
      });
      if (admission.kind === "concurrency-limited")
        throw new AiGenerationError("AI_CONCURRENCY_LIMITED");
      if (admission.kind === "insufficient-credits")
        throw new AiGenerationError("AI_INSUFFICIENT_CREDITS");
      if (admission.kind === "rate-limited") throw new AiGenerationError("AI_RATE_LIMITED");
      if (admission.kind === "regeneration-active")
        throw new AiGenerationError("AI_REGENERATION_ACTIVE");
      if (admission.kind === "regeneration-limit" || admission.kind === "regeneration-mismatch")
        throw new AiGenerationError("AI_REGENERATION_LIMIT");
      if (admission.kind === "existing") {
        if (admission.operation.status === "running")
          return { kind: "in-progress" as const, operationId: admission.operation.id };
        if (admission.operation.status === "failed")
          throw storedError(admission.operation.errorCode);
        return {
          draft: parseStoredMaterialImprovementDraft(admission.operation),
          kind: "completed" as const,
          operationId: admission.operation.id,
          reused: true,
        };
      }

      const startedAt = Date.now();
      let attempts = 0;
      try {
        while (attempts < 2) {
          attempts += 1;
          try {
            const request = {
              idempotencyKey: input.idempotencyKey,
              maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
              prompt: prompt.prompt,
              schemaDescription: "Uma versão melhorada de um único material de estudo.",
              schemaName: "lazuli_material_improvement",
              system: prompt.system,
              timeoutMs: provider.requestTimeoutMs,
              userIdentifier: anonymousUserIdentifier(input.userId),
            };
            const generatedResult =
              input.kind === "flashcard"
                ? {
                    kind: "flashcard" as const,
                    result: await provider.generateStructured({
                      ...request,
                      schema: flashcardImprovementProviderDraftSchema,
                    }),
                  }
                : {
                    kind: "quizQuestion" as const,
                    result: await provider.generateStructured({
                      ...request,
                      schema: quizImprovementProviderDraftSchema,
                    }),
                  };
            const result = generatedResult.result;
            const generated = result.output;
            const expiresAt = new Date(Date.now() + AI_DRAFT_TTL_MS);
            const draft = aiMaterialImprovementDraftSchema.parse({
              operationId,
              collectionId: input.collectionId,
              materialId: input.materialId,
              materialUpdatedAt: input.materialUpdatedAt,
              intent: input.intent,
              guidance: input.guidance,
              consumedCredits: input.regenerateOperationId ? 0 : 10,
              regenerationCount: admission.regenerationCount,
              expiresAt: expiresAt.toISOString(),
              approved: false,
              references: input.references,
              warning: generated.warning,
              kind: input.kind,
              current: input.current,
              proposed: generated,
            });
            await store.complete({
              attempts,
              effectiveModel: result.effectiveModel,
              estimatedCostMicroUsd: estimateAiCostMicroUsd(result.usage),
              expiresAt,
              latencyMs: Date.now() - startedAt,
              operationId,
              providerRequestId: result.providerRequestId,
              result: draft,
              usage: result.usage,
              userId: input.userId,
              validItems: 1,
            });
            return { draft, kind: "completed" as const, operationId, reused: false };
          } catch (error) {
            const normalized = normalizeAiError(error);
            if (!normalized.retryable || attempts >= 2) throw normalized;
            await pause(retryDelayMs);
          }
        }
        throw new AiGenerationError("AI_REQUEST_FAILED");
      } catch (error) {
        const normalized = normalizeAiError(error);
        await store.fail({
          attempts,
          code: normalized.code,
          latencyMs: Date.now() - startedAt,
          operationId,
          userId: input.userId,
        });
        throw normalized;
      }
    },

    discardCollectionDraft: (userId: string, operationId: string) =>
      store.discardCollection(userId, operationId),

    async failCollectionDraft(userId: string, operationId: string, error: unknown) {
      const normalized = normalizeAiError(error);
      await store.fail({
        attempts: 1,
        code: normalized.code,
        latencyMs: 0,
        operationId,
        userId,
      });
    },

    getCollectionDraft,

    async getLatestCollectionDraft(userId: string, collectionId: string) {
      const operation = await store.findLatestCollection(userId, collectionId);
      if (!operation) return null;
      return getCollectionDraft(userId, operation.id);
    },

    async enqueueCollectionDraft(input: CollectionGenerationInput) {
      const contextFingerprint = fingerprint({
        collectionId: input.collectionId,
        documentId: input.documentId,
        documentRevision: input.documentRevision,
        guidance: input.guidance,
        kind: input.kind,
        quantity: input.quantity,
        sourceBlockIds: input.sourceBlockIds,
      });
      const operationId = randomUUID();
      const admission = await store.begin({
        contextFingerprint,
        id: operationId,
        idempotencyKey: input.idempotencyKey,
        estimatedCredits: estimateAiCredits(input.quantity),
        initialResult: {
          job: {
            collectionId: input.collectionId,
            documentId: input.documentId,
            documentTitle: input.documentTitle,
            documentRevision: input.documentRevision,
            guidance: input.guidance,
            kind: input.kind,
            quantity: input.quantity,
            projectId: input.projectId,
            projectTitle: input.projectTitle,
            sourceBlockIds: input.sourceBlockIds,
            sourceScope: input.sourceBlockIds.length ? "section" : "document",
          } satisfies CollectionGenerationJob,
        },
        origin: "collection",
        promptVersion: COLLECTION_PROMPT_VERSION,
        provider: provider.name,
        requestedItems: input.quantity,
        regenerationOfId: null,
        requestedModel: provider.model,
        sourceIds: [input.documentId, ...input.sourceBlockIds],
        type: "collection_generation",
        userId: input.userId,
      });
      if (admission.kind === "concurrency-limited")
        throw new AiGenerationError("AI_CONCURRENCY_LIMITED");
      if (admission.kind === "insufficient-credits")
        throw new AiGenerationError("AI_INSUFFICIENT_CREDITS");
      if (admission.kind === "rate-limited") throw new AiGenerationError("AI_RATE_LIMITED");
      if (
        admission.kind === "regeneration-active" ||
        admission.kind === "regeneration-limit" ||
        admission.kind === "regeneration-mismatch"
      )
        throw new AiGenerationError("AI_REGENERATION_LIMIT");
      if (admission.kind === "existing") {
        if (admission.operation.status === "failed")
          throw storedError(admission.operation.errorCode);
        if (admission.operation.status === "succeeded")
          return {
            kind: "completed" as const,
            draft: parseStoredCollectionDraft(admission.operation),
          };
        return {
          kind: admission.operation.leaseOwner ? ("processing" as const) : ("queued" as const),
          operationId: admission.operation.id,
        };
      }
      return { kind: "queued" as const, operationId };
    },

    async processCollectionDraft({
      blocks,
      job,
      operationId,
      userId,
    }: {
      blocks: AiSourceBlock[];
      job: CollectionGenerationJob;
      operationId: string;
      userId: string;
    }) {
      const startedAt = Date.now();
      let attempts = 0;
      try {
        assertInputLimits({
          blocks,
          idempotencyKey: operationId,
          sourceIds: [job.documentId, ...job.sourceBlockIds],
          userId,
        });
        const prompt = createCollectionPrompt({ ...job, blocks });
        while (attempts < 2) {
          attempts += 1;
          try {
            const result = await provider.generateStructured({
              idempotencyKey: operationId,
              maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
              prompt: prompt.prompt,
              schema: collectionProviderDraftSchema,
              schemaDescription: `${job.quantity} materiais diversos do tipo ${job.kind}.`,
              schemaName: "lazuli_collection_draft",
              system: prompt.system,
              timeoutMs: provider.requestTimeoutMs,
              userIdentifier: anonymousUserIdentifier(userId),
            });
            const generated = collectionProviderDraftSchema.parse(result.output);
            const proposals =
              job.kind === "flashcard" ? generated.flashcards : generated.quizQuestions;
            if (!proposals.length || proposals.length > job.quantity)
              throw new AiGenerationError("AI_INVALID_OUTPUT");
            const expiresAt = new Date(Date.now() + AI_DRAFT_TTL_MS);
            const sourceById = new Map(blocks.map((block) => [block.id, block.text]));
            const draft = aiCollectionDraftSchema.parse({
              operationId,
              kind: job.kind,
              collectionId: job.collectionId,
              documentId: job.documentId,
              documentTitle: job.documentTitle,
              documentRevision: job.documentRevision,
              anchorId: null,
              sourceScope: job.sourceScope,
              sourceBlockIds: blocks.map(({ id }) => id),
              sourceText: blocks.map(({ text }) => text).join(" "),
              requestedItems: job.quantity,
              projectId: job.projectId,
              projectTitle: job.projectTitle,
              consumedCredits: proposals.length * 10,
              regenerationCount: 0,
              expiresAt: expiresAt.toISOString(),
              approved: false,
              flashcards: generated.flashcards.map((item) => ({
                ...withValidatedReferences(item, blocks),
                id: randomUUID(),
                evidence:
                  item.evidence ||
                  item.sourceBlockIds
                    .map((id) => sourceById.get(id))
                    .filter(Boolean)
                    .join(" "),
              })),
              quizQuestions: generated.quizQuestions.map((item) => ({
                ...withValidatedReferences(item, blocks),
                id: randomUUID(),
                evidence:
                  item.evidence ||
                  item.sourceBlockIds
                    .map((id) => sourceById.get(id))
                    .filter(Boolean)
                    .join(" "),
              })),
            });
            await store.complete({
              attempts,
              effectiveModel: result.effectiveModel,
              estimatedCostMicroUsd: estimateAiCostMicroUsd(result.usage),
              expiresAt,
              latencyMs: Date.now() - startedAt,
              operationId,
              providerRequestId: result.providerRequestId,
              result: draft,
              usage: result.usage,
              userId,
              validItems: proposals.length,
            });
            return;
          } catch (error) {
            const normalized = normalizeAiError(error);
            if (!normalized.retryable || attempts >= 2) throw normalized;
            await pause(retryDelayMs);
          }
        }
      } catch (error) {
        const normalized = normalizeAiError(error);
        await store.fail({
          attempts,
          code: normalized.code,
          latencyMs: Date.now() - startedAt,
          operationId,
          userId,
        });
        throw normalized;
      }
    },

    async getSelectionDraft(userId: string, operationId: string) {
      const operation = await store.get(userId, operationId);
      if (!operation || operation.type !== "selection_generation") return null;
      if (operation.status === "running")
        return { kind: "in-progress" as const, operationId: operation.id };
      if (operation.status === "failed") throw storedError(operation.errorCode);
      return {
        draft: parseStoredSelectionDraft(operation),
        kind: "completed" as const,
        operationId: operation.id,
        reused: true,
      };
    },

    async generateSelectionDraft(
      input: SelectionGenerationInput,
    ): Promise<SelectionGenerationResult> {
      assertInputLimits({
        blocks: input.blocks,
        idempotencyKey: input.idempotencyKey,
        sourceIds: [input.documentId, ...input.sourceBlockIds],
        userId: input.userId,
      });
      const prompt = createSelectionPrompt(input);
      const sourceIds = [input.documentId, ...input.sourceBlockIds];
      const contextFingerprint = fingerprint({
        blocks: input.blocks,
        collectionId: input.collectionId,
        documentId: input.documentId,
        guidance: input.guidance,
        kind: input.kind,
        quantity: input.quantity,
        selectedText: input.selectedText,
        sourceScope: input.sourceScope,
        sourceBlockIds: input.sourceBlockIds,
      });
      const operationId = randomUUID();
      const admission = await store.begin({
        contextFingerprint,
        id: operationId,
        idempotencyKey: input.idempotencyKey,
        estimatedCredits: estimateAiCredits(input.quantity),
        origin: "document_selection",
        promptVersion: prompt.promptVersion,
        provider: provider.name,
        requestedItems: input.quantity,
        regenerationOfId: input.regenerateOperationId ?? null,
        requestedModel: provider.model,
        sourceIds,
        type: "selection_generation",
        userId: input.userId,
      });
      if (admission.kind === "concurrency-limited")
        throw new AiGenerationError("AI_CONCURRENCY_LIMITED");
      if (admission.kind === "insufficient-credits")
        throw new AiGenerationError("AI_INSUFFICIENT_CREDITS");
      if (admission.kind === "rate-limited") throw new AiGenerationError("AI_RATE_LIMITED");
      if (admission.kind === "regeneration-active")
        throw new AiGenerationError("AI_REGENERATION_ACTIVE");
      if (admission.kind === "regeneration-limit" || admission.kind === "regeneration-mismatch")
        throw new AiGenerationError("AI_REGENERATION_LIMIT");
      if (admission.kind === "existing") {
        if (admission.operation.status === "running")
          return { kind: "in-progress", operationId: admission.operation.id };
        if (admission.operation.status === "failed")
          throw storedError(admission.operation.errorCode);
        return {
          draft: parseStoredSelectionDraft(admission.operation),
          kind: "completed",
          operationId: admission.operation.id,
          reused: true,
        };
      }

      const startedAt = Date.now();
      let attempts = 0;
      try {
        while (attempts < 2) {
          attempts += 1;
          try {
            const result = await provider.generateStructured({
              idempotencyKey: input.idempotencyKey,
              images: input.images,
              maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
              prompt: prompt.prompt,
              schema: selectionProviderDraftSchema,
              schemaDescription: `${input.quantity} materiais do tipo ${input.kind} baseados exclusivamente na seleção.`,
              schemaName: "lazuli_selection_draft",
              system: prompt.system,
              timeoutMs: provider.requestTimeoutMs,
              userIdentifier: anonymousUserIdentifier(input.userId),
            });
            const generated = selectionProviderDraftSchema.parse(result.output);
            const proposals =
              input.kind === "flashcard" ? generated.flashcards : generated.quizQuestions;
            if (proposals.length === 0 || proposals.length > input.quantity)
              throw new AiGenerationError("AI_INVALID_OUTPUT");
            const expiresAt = new Date(Date.now() + AI_DRAFT_TTL_MS);
            const draft = aiSelectionDraftSchema.parse({
              operationId,
              kind: input.kind,
              collectionId: input.collectionId,
              documentId: input.documentId,
              documentTitle: input.documentTitle,
              documentRevision: input.documentRevision,
              anchorId: input.anchorId,
              sourceScope: input.sourceScope,
              sourceBlockIds: input.sourceBlockIds,
              sourceText: input.selectedText,
              requestedItems: input.quantity,
              projectId: input.projectId,
              projectTitle: input.projectTitle,
              consumedCredits: input.regenerateOperationId ? 0 : proposals.length * 10,
              regenerationCount: admission.regenerationCount,
              expiresAt: expiresAt.toISOString(),
              approved: false,
              flashcards: generated.flashcards.map((item) => {
                const references = proposalReferences({
                  blocks: input.blocks,
                  references: item.references,
                  sourceScope: input.sourceScope,
                  sourceText: input.selectedText,
                });
                return {
                  ...item,
                  id: randomUUID(),
                  references,
                  referenceWarning:
                    references.length > 0
                      ? null
                      : "A referência sugerida não foi encontrada literalmente no documento.",
                };
              }),
              quizQuestions: generated.quizQuestions.map((item) => {
                const references = proposalReferences({
                  blocks: input.blocks,
                  references: item.references,
                  sourceScope: input.sourceScope,
                  sourceText: input.selectedText,
                });
                return {
                  ...item,
                  id: randomUUID(),
                  references,
                  referenceWarning:
                    references.length > 0
                      ? null
                      : "A referência sugerida não foi encontrada literalmente no documento.",
                };
              }),
            });
            const latencyMs = Date.now() - startedAt;
            await store.complete({
              attempts,
              effectiveModel: result.effectiveModel,
              estimatedCostMicroUsd: estimateAiCostMicroUsd(result.usage),
              expiresAt,
              latencyMs,
              operationId,
              providerRequestId: result.providerRequestId,
              result: draft,
              usage: result.usage,
              userId: input.userId,
              validItems: proposals.length,
            });
            return { draft, kind: "completed", operationId, reused: false };
          } catch (error) {
            const normalized = normalizeAiError(error);
            if (!normalized.retryable || attempts >= 2) throw normalized;
            await pause(retryDelayMs);
          }
        }
        throw new AiGenerationError("AI_REQUEST_FAILED");
      } catch (error) {
        const normalized = normalizeAiError(error);
        await store.fail({
          attempts,
          code: normalized.code,
          latencyMs: Date.now() - startedAt,
          operationId,
          userId: input.userId,
        });
        throw normalized;
      }
    },

    async generateFoundationDraft(
      input: FoundationGenerationInput,
    ): Promise<FoundationGenerationResult> {
      assertInputLimits(input);
      const prompt = createFoundationPrompt(input.blocks);
      const sourceIds = [...new Set(input.sourceIds)].sort();
      const contextFingerprint = fingerprint({ blocks: input.blocks, sourceIds });
      const operationId = randomUUID();
      const admission = await store.begin({
        contextFingerprint,
        id: operationId,
        idempotencyKey: input.idempotencyKey,
        estimatedCredits: estimateAiCredits(2),
        origin: "internal",
        promptVersion: prompt.promptVersion,
        provider: provider.name,
        requestedItems: 2,
        regenerationOfId: input.regenerateOperationId ?? null,
        requestedModel: provider.model,
        sourceIds,
        type: "foundation_draft",
        userId: input.userId,
      });
      if (admission.kind === "concurrency-limited")
        throw new AiGenerationError("AI_CONCURRENCY_LIMITED");
      if (admission.kind === "insufficient-credits")
        throw new AiGenerationError("AI_INSUFFICIENT_CREDITS");
      if (admission.kind === "rate-limited") throw new AiGenerationError("AI_RATE_LIMITED");
      if (admission.kind === "regeneration-active")
        throw new AiGenerationError("AI_REGENERATION_ACTIVE");
      if (admission.kind === "regeneration-limit" || admission.kind === "regeneration-mismatch")
        throw new AiGenerationError("AI_REGENERATION_LIMIT");
      if (admission.kind === "existing") {
        if (admission.operation.status === "running")
          return { kind: "in-progress", operationId: admission.operation.id };
        if (admission.operation.status === "failed")
          throw storedError(admission.operation.errorCode);
        const draft = foundationDraftSchema.parse(admission.operation.result);
        return {
          draft,
          kind: "completed",
          operationId: admission.operation.id,
          reused: true,
        };
      }

      const startedAt = Date.now();
      let attempts = 0;
      try {
        while (attempts < 2) {
          attempts += 1;
          try {
            const result = await provider.generateStructured({
              idempotencyKey: input.idempotencyKey,
              maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
              prompt: prompt.prompt,
              schema: foundationDraftSchema,
              schemaDescription:
                "Um flashcard e uma questão de múltipla escolha baseados na fonte.",
              schemaName: "lazuli_foundation_draft",
              system: prompt.system,
              timeoutMs: provider.requestTimeoutMs,
              userIdentifier: anonymousUserIdentifier(input.userId),
            });
            const draft = foundationDraftSchema.parse(result.output);
            assertReferencedBlocksExist(draft, input.blocks);
            const latencyMs = Date.now() - startedAt;
            const validItems = countFoundationDraftItems(draft);
            await store.complete({
              attempts,
              effectiveModel: result.effectiveModel,
              estimatedCostMicroUsd: estimateAiCostMicroUsd(result.usage),
              expiresAt: new Date(Date.now() + AI_DRAFT_TTL_MS),
              latencyMs,
              operationId,
              providerRequestId: result.providerRequestId,
              result: draft,
              usage: result.usage,
              userId: input.userId,
              validItems,
            });
            logger.info(
              {
                attempts,
                inputTokens: result.usage.inputTokens,
                latencyMs,
                operationId,
                outputTokens: result.usage.outputTokens,
                provider: provider.name,
                requestedModel: provider.model,
                userId: input.userId,
                validItems,
              },
              "AI generation completed",
            );
            return { draft, kind: "completed", operationId, reused: false };
          } catch (error) {
            const normalized = normalizeAiError(error);
            if (!normalized.retryable || attempts >= 2) throw normalized;
            logger.warn(
              { code: normalized.code, operationId, provider: provider.name, userId: input.userId },
              "AI generation transient failure; retrying once",
            );
            await pause(retryDelayMs);
          }
        }
        throw new AiGenerationError("AI_REQUEST_FAILED");
      } catch (error) {
        const normalized = normalizeAiError(error);
        const latencyMs = Date.now() - startedAt;
        await store.fail({
          attempts,
          code: normalized.code,
          latencyMs,
          operationId,
          userId: input.userId,
        });
        logger.error(
          {
            attempts,
            code: normalized.code,
            latencyMs,
            operationId,
            provider: provider.name,
            userId: input.userId,
          },
          "AI generation failed",
        );
        throw normalized;
      }
    },
  };
};

export type AiGenerationService = ReturnType<typeof createAiGenerationService>;
