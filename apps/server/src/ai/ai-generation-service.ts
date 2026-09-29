import { createHash, randomUUID } from "node:crypto";

import type { Logger } from "pino";

import { AiGenerationError, aiErrorCodes, normalizeAiError } from "./ai-errors.ts";
import type { AiGenerationStore } from "./ai-generation-store.ts";
import {
  AI_DRAFT_TTL_MS,
  AI_MAX_CONTEXT_BLOCKS,
  AI_MAX_CONTEXT_BYTES,
  AI_MAX_OUTPUT_TOKENS,
  AI_MAX_SOURCE_IDS,
  estimateAiCostMicroUsd,
} from "./ai-model-config.ts";
import { createFoundationPrompt, type AiSourceBlock } from "./ai-prompts.ts";
import type { AiProvider } from "./ai-provider.ts";
import {
  countFoundationDraftItems,
  foundationDraftSchema,
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

export type FoundationGenerationResult =
  | { draft: FoundationDraft; kind: "completed"; operationId: string; reused: boolean }
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

const storedError = (errorCode: string | null) => {
  const code = aiErrorCodes.find((candidate) => candidate === errorCode);
  return new AiGenerationError(code ?? "AI_REQUEST_FAILED");
};

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
}) => ({
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
      if (admission.operation.status === "failed") throw storedError(admission.operation.errorCode);
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
            schemaDescription: "Um flashcard e uma questão de múltipla escolha baseados na fonte.",
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
});

export type AiGenerationService = ReturnType<typeof createAiGenerationService>;
