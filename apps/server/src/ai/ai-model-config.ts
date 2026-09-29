import type { ServerEnv } from "../config.ts";

export const AI_PROVIDER = "openai" as const;
export const AI_DRAFT_TTL_MS = 24 * 60 * 60 * 1_000;
export const AI_MAX_CONCURRENT_GENERATIONS_PER_USER = 2;
export const AI_MAX_GENERATIONS_PER_WINDOW = 30;
export const AI_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
export const AI_MAX_CONTEXT_BYTES = 96 * 1_024;
export const AI_MAX_CONTEXT_BLOCKS = 400;
export const AI_MAX_OUTPUT_TOKENS = 6_000;
export const AI_MAX_SOURCE_IDS = 400;

export type AiModelConfig = {
  model: "gpt-6-luna";
  provider: typeof AI_PROVIDER;
  requestTimeoutMs: number;
};

export const getAiModelConfig = (env: ServerEnv): AiModelConfig => ({
  model: env.AI_MODEL,
  provider: AI_PROVIDER,
  requestTimeoutMs: env.AI_GENERATION_TIMEOUT_MS,
});

// USD per one million tokens. Centralized so a pricing change never alters domain code.
export const AI_MODEL_PRICING = {
  cachedInput: 0.01,
  input: 0.1,
  output: 0.5,
} as const;

export const estimateAiCostMicroUsd = ({
  cachedInputTokens = 0,
  inputTokens = 0,
  outputTokens = 0,
}: {
  cachedInputTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}) =>
  Math.ceil(
    inputTokens * AI_MODEL_PRICING.input +
      cachedInputTokens * AI_MODEL_PRICING.cachedInput +
      outputTokens * AI_MODEL_PRICING.output,
  );
