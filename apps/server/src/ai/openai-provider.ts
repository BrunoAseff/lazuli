import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import type { ServerEnv } from "../config.ts";
import { AiGenerationError, normalizeAiError } from "./ai-errors.ts";
import { getAiModelConfig } from "./ai-model-config.ts";
import type { AiProvider } from "./ai-provider.ts";

const tokenCount = (value: number | undefined) => value ?? 0;

export const createOpenAiProvider = (env: ServerEnv): AiProvider => {
  if (!env.AI_REAL_CALLS_ENABLED || !env.OPENAI_API_KEY)
    throw new AiGenerationError("AI_CONFIGURATION_ERROR");

  const config = getAiModelConfig(env);
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  return {
    model: config.model,
    name: config.provider,
    requestTimeoutMs: config.requestTimeoutMs,
    async generateStructured(request) {
      try {
        const messages = request.images?.length
          ? [
              {
                role: "user" as const,
                content: [
                  { type: "text" as const, text: request.prompt },
                  ...request.images.map(({ data, mediaType }) => ({
                    type: "image" as const,
                    image: data,
                    mediaType: mediaType as `${string}/${string}`,
                  })),
                ],
              },
            ]
          : undefined;
        const result = await generateText({
          abortSignal: AbortSignal.timeout(request.timeoutMs),
          headers: { "Idempotency-Key": request.idempotencyKey },
          maxOutputTokens: request.maxOutputTokens,
          maxRetries: 0,
          model: openai.responses(config.model),
          output: Output.object({
            description: request.schemaDescription,
            name: request.schemaName,
            schema: request.schema,
          }),
          ...(messages ? { messages } : { prompt: request.prompt }),
          providerOptions: {
            openai: {
              reasoningEffort: "low",
              store: false,
              user: request.userIdentifier,
            } satisfies OpenAILanguageModelResponsesOptions,
          },
          system: request.system,
        });
        if (!result.output) throw new AiGenerationError("AI_INVALID_OUTPUT");
        return {
          effectiveModel: config.model,
          output: request.schema.parse(result.output),
          providerRequestId: result.response.id ?? null,
          usage: {
            cachedInputTokens: tokenCount(result.usage.inputTokenDetails.cacheReadTokens),
            inputTokens: tokenCount(result.usage.inputTokenDetails.noCacheTokens),
            outputTokens: tokenCount(result.usage.outputTokens),
            totalTokens: tokenCount(result.usage.totalTokens),
          },
        };
      } catch (error) {
        throw normalizeAiError(error);
      }
    },
  };
};
