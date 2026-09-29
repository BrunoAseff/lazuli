import { and, count, desc, eq, gte, sql } from "drizzle-orm";

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
>;

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
    | { kind: "created"; operation: AiGenerationRecord }
    | { kind: "existing"; operation: AiGenerationRecord }
    | { kind: "concurrency-limited" }
    | { kind: "rate-limited" }
  >;
  complete(input: CompleteAiGenerationInput): Promise<void>;
  fail(input: {
    attempts: number;
    code: AiErrorCode;
    latencyMs: number;
    operationId: string;
    userId: string;
  }): Promise<void>;
}

export const createAiGenerationStore = (database: Database): AiGenerationStore => ({
  async begin(input) {
    return database.transaction(async (tx) => {
      // Serializes admission for one account, making both limits race-safe across server replicas.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);
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

      const [operation] = await tx.insert(aiGeneration).values(input).returning();
      if (!operation) throw new Error("AI generation operation was not created");
      return { kind: "created" as const, operation };
    });
  },

  async complete(input) {
    await database
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
        status: "succeeded",
        totalTokens: input.usage.totalTokens,
        validItems: input.validItems,
      })
      .where(
        and(
          eq(aiGeneration.id, input.operationId),
          eq(aiGeneration.userId, input.userId),
          eq(aiGeneration.status, "running"),
        ),
      );
  },

  async fail(input) {
    await database
      .update(aiGeneration)
      .set({
        attempts: input.attempts,
        errorCode: input.code,
        finishedAt: new Date(),
        latencyMs: input.latencyMs,
        status: "failed",
      })
      .where(
        and(
          eq(aiGeneration.id, input.operationId),
          eq(aiGeneration.userId, input.userId),
          eq(aiGeneration.status, "running"),
        ),
      );
  },
});
