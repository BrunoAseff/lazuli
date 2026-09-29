import type { z } from "zod";

export type AiTokenUsage = {
  cachedInputTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AiStructuredGenerationRequest<T> = {
  idempotencyKey: string;
  maxOutputTokens: number;
  prompt: string;
  schema: z.ZodType<T>;
  schemaDescription: string;
  schemaName: string;
  system: string;
  timeoutMs: number;
  userIdentifier: string;
};

export type AiStructuredGenerationResult<T> = {
  effectiveModel: string;
  output: T;
  providerRequestId: string | null;
  usage: AiTokenUsage;
};

export interface AiProvider {
  readonly model: string;
  readonly name: string;
  readonly requestTimeoutMs: number;
  generateStructured<T>(
    request: AiStructuredGenerationRequest<T>,
  ): Promise<AiStructuredGenerationResult<T>>;
}
