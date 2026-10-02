import { and, count, desc, eq, gte } from "drizzle-orm";

import {
  AI_FREE_REGENERATIONS,
  calculateAiCreditSettlement,
} from "../ai-credits/ai-credit-config.ts";
import {
  appendAiCreditLedgerEntry,
  lockAiCreditAccount,
  updateAiCreditAccount,
} from "../ai-credits/ai-credit-transactions.ts";
import type { Database } from "../database/client.ts";
import { aiGeneration } from "../database/schema/index.ts";
import {
  AI_MAX_CONCURRENT_GENERATIONS_PER_USER,
  AI_MAX_GENERATIONS_PER_WINDOW,
  AI_RATE_LIMIT_WINDOW_MS,
} from "./ai-model-config.ts";
import type { AiErrorCode } from "./ai-errors.ts";
import type { AiTokenUsage } from "./ai-provider.ts";

export type AiGenerationRecord = typeof aiGeneration.$inferSelect;

export type BeginAiGenerationInput = Pick<
  typeof aiGeneration.$inferInsert,
  | "contextFingerprint"
  | "id"
  | "idempotencyKey"
  | "origin"
  | "promptVersion"
  | "provider"
  | "requestedItems"
  | "requestedModel"
  | "sourceIds"
  | "type"
  | "userId"
> & {
  estimatedCredits: number;
  regenerationOfId: string | null;
};

export type CompleteAiGenerationInput = {
  attempts: number;
  effectiveModel: string;
  estimatedCostMicroUsd: number;
  expiresAt: Date;
  latencyMs: number;
  operationId: string;
  providerRequestId: string | null;
  result: unknown;
  usage: AiTokenUsage;
  userId: string;
  validItems: number;
};

export interface AiGenerationStore {
  begin(
    input: BeginAiGenerationInput,
  ): Promise<
    | { kind: "created"; operation: AiGenerationRecord; regenerationCount: number }
    | { kind: "existing"; operation: AiGenerationRecord }
    | { kind: "concurrency-limited" }
    | { kind: "insufficient-credits" }
    | { kind: "rate-limited" }
    | { kind: "regeneration-active" }
    | { kind: "regeneration-limit" }
    | { kind: "regeneration-mismatch" }
  >;
  complete(input: CompleteAiGenerationInput): Promise<void>;
  fail(input: {
    attempts: number;
    code: AiErrorCode;
    latencyMs: number;
    operationId: string;
    userId: string;
  }): Promise<void>;
  get(userId: string, operationId: string): Promise<AiGenerationRecord | null>;
}

export const createAiGenerationStore = (database: Database): AiGenerationStore => ({
  async get(userId, operationId) {
    const [operation] = await database
      .select()
      .from(aiGeneration)
      .where(and(eq(aiGeneration.id, operationId), eq(aiGeneration.userId, userId)))
      .limit(1);
    return operation ?? null;
  },

  async begin(input) {
    return database.transaction(async (tx) => {
      // Serializes admission and balance changes for one account across server replicas.
      const account = await lockAiCreditAccount(tx, input.userId);
      const [existing] = await tx
        .select()
        .from(aiGeneration)
        .where(
          and(
            eq(aiGeneration.userId, input.userId),
            eq(aiGeneration.idempotencyKey, input.idempotencyKey),
          ),
        )
        .orderBy(desc(aiGeneration.createdAt))
        .limit(1);
      if (existing) return { kind: "existing" as const, operation: existing };

      let regenerationOfId: string | null = null;
      let regenerationCount = 0;
      if (input.regenerationOfId) {
        const [requestedParent] = await tx
          .select()
          .from(aiGeneration)
          .where(
            and(eq(aiGeneration.id, input.regenerationOfId), eq(aiGeneration.userId, input.userId)),
          )
          .limit(1);
        if (!requestedParent) return { kind: "regeneration-mismatch" as const };
        regenerationOfId = requestedParent.regenerationOfId ?? requestedParent.id;
        const [root] = await tx
          .select()
          .from(aiGeneration)
          .where(
            and(
              eq(aiGeneration.id, regenerationOfId),
              eq(aiGeneration.userId, input.userId),
              eq(aiGeneration.status, "succeeded"),
            ),
          )
          .limit(1);
        if (
          !root ||
          root.consumedCredits <= 0 ||
          root.contextFingerprint !== input.contextFingerprint ||
          root.type !== input.type ||
          root.requestedItems !== input.requestedItems
        )
          return { kind: "regeneration-mismatch" as const };

        const [activeRegeneration] = await tx
          .select({ value: count() })
          .from(aiGeneration)
          .where(
            and(
              eq(aiGeneration.regenerationOfId, regenerationOfId),
              eq(aiGeneration.status, "running"),
            ),
          );
        if ((activeRegeneration?.value ?? 0) > 0) return { kind: "regeneration-active" as const };
        const [successfulRegenerations] = await tx
          .select({ value: count() })
          .from(aiGeneration)
          .where(
            and(
              eq(aiGeneration.regenerationOfId, regenerationOfId),
              eq(aiGeneration.status, "succeeded"),
            ),
          );
        regenerationCount = successfulRegenerations?.value ?? 0;
        if (regenerationCount >= AI_FREE_REGENERATIONS)
          return { kind: "regeneration-limit" as const };
      }

      const [active] = await tx
        .select({ value: count() })
        .from(aiGeneration)
        .where(and(eq(aiGeneration.userId, input.userId), eq(aiGeneration.status, "running")));
      if ((active?.value ?? 0) >= AI_MAX_CONCURRENT_GENERATIONS_PER_USER)
        return { kind: "concurrency-limited" as const };

      const windowStart = new Date(Date.now() - AI_RATE_LIMIT_WINDOW_MS);
      const [recent] = await tx
        .select({ value: count() })
        .from(aiGeneration)
        .where(
          and(eq(aiGeneration.userId, input.userId), gte(aiGeneration.createdAt, windowStart)),
        );
      if ((recent?.value ?? 0) >= AI_MAX_GENERATIONS_PER_WINDOW)
        return { kind: "rate-limited" as const };

      const reservedCredits = regenerationOfId ? 0 : input.estimatedCredits;
      if (account.availableBalance < reservedCredits)
        return { kind: "insufficient-credits" as const };

      const [operation] = await tx
        .insert(aiGeneration)
        .values({ ...input, regenerationOfId, reservedCredits })
        .returning();
      if (!operation) throw new Error("AI generation operation was not created");
      if (reservedCredits > 0) {
        const entry = await appendAiCreditLedgerEntry(tx, {
          actorId: input.userId,
          actorType: "user",
          amount: reservedCredits,
          generationId: operation.id,
          idempotencyKey: `generation:${operation.id}:reserve`,
          reason: "Reserva para geração de materiais",
          type: "reserve",
          userId: input.userId,
        });
        if (!entry) throw new Error("AI generation credit reservation was not recorded");
        await updateAiCreditAccount(tx, {
          availableDelta: -reservedCredits,
          reservedDelta: reservedCredits,
          userId: input.userId,
        });
      }
      return {
        kind: "created" as const,
        operation,
        regenerationCount: regenerationOfId ? regenerationCount + 1 : 0,
      };
    });
  },

  async complete(input) {
    await database.transaction(async (tx) => {
      await lockAiCreditAccount(tx, input.userId);
      const [operation] = await tx
        .select()
        .from(aiGeneration)
        .where(
          and(
            eq(aiGeneration.id, input.operationId),
            eq(aiGeneration.userId, input.userId),
            eq(aiGeneration.status, "running"),
          ),
        )
        .for("update");
      if (!operation) return;
      const settlement = operation.regenerationOfId
        ? { consumed: 0, released: 0 }
        : calculateAiCreditSettlement(operation.reservedCredits, input.validItems);
      const consumedCredits = settlement.consumed;
      const releasedCredits = settlement.released;
      if (consumedCredits > 0)
        await appendAiCreditLedgerEntry(tx, {
          actorId: "ai-generation",
          actorType: "system",
          amount: consumedCredits,
          generationId: operation.id,
          idempotencyKey: `generation:${operation.id}:consume`,
          reason: "Materiais válidos gerados",
          type: "consume",
          userId: input.userId,
        });
      if (releasedCredits > 0)
        await appendAiCreditLedgerEntry(tx, {
          actorId: "ai-generation",
          actorType: "system",
          amount: releasedCredits,
          generationId: operation.id,
          idempotencyKey: `generation:${operation.id}:release`,
          reason: "Excedente da reserva de geração",
          type: "release",
          userId: input.userId,
        });
      if (operation.reservedCredits > 0)
        await updateAiCreditAccount(tx, {
          availableDelta: releasedCredits,
          reservedDelta: -operation.reservedCredits,
          userId: input.userId,
        });
      await tx
        .update(aiGeneration)
        .set({
          attempts: input.attempts,
          cachedInputTokens: input.usage.cachedInputTokens,
          effectiveModel: input.effectiveModel,
          estimatedCostMicroUsd: input.estimatedCostMicroUsd,
          expiresAt: input.expiresAt,
          finishedAt: new Date(),
          inputTokens: input.usage.inputTokens,
          latencyMs: input.latencyMs,
          outputTokens: input.usage.outputTokens,
          providerRequestId: input.providerRequestId,
          result: input.result,
          consumedCredits,
          reservedCredits: 0,
          status: "succeeded",
          totalTokens: input.usage.totalTokens,
          validItems: input.validItems,
        })
        .where(eq(aiGeneration.id, operation.id));
    });
  },

  async fail(input) {
    await database.transaction(async (tx) => {
      await lockAiCreditAccount(tx, input.userId);
      const [operation] = await tx
        .select()
        .from(aiGeneration)
        .where(
          and(
            eq(aiGeneration.id, input.operationId),
            eq(aiGeneration.userId, input.userId),
            eq(aiGeneration.status, "running"),
          ),
        )
        .for("update");
      if (!operation) return;
      if (operation.reservedCredits > 0) {
        await appendAiCreditLedgerEntry(tx, {
          actorId: "ai-generation",
          actorType: "system",
          amount: operation.reservedCredits,
          generationId: operation.id,
          idempotencyKey: `generation:${operation.id}:failure-release`,
          reason: "Geração não concluída",
          type: "release",
          userId: input.userId,
        });
        await updateAiCreditAccount(tx, {
          availableDelta: operation.reservedCredits,
          reservedDelta: -operation.reservedCredits,
          userId: input.userId,
        });
      }
      await tx
        .update(aiGeneration)
        .set({
          attempts: input.attempts,
          errorCode: input.code,
          finishedAt: new Date(),
          latencyMs: input.latencyMs,
          reservedCredits: 0,
          status: "failed",
        })
        .where(eq(aiGeneration.id, operation.id));
    });
  },
});
