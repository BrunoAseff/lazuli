import type { AiProvider } from "./ai-provider.ts";

export const createFakeAiProvider = ({
  output,
  error,
}: {
  output?: unknown;
  error?: unknown;
}): AiProvider => ({
  model: "fake-luna",
  name: "fake",
  requestTimeoutMs: 1_000,
  async generateStructured(request) {
    if (error) throw error;
    return {
      effectiveModel: "fake-luna",
      output: request.schema.parse(output),
      providerRequestId: "fake-response",
      usage: {
        cachedInputTokens: 0,
        inputTokens: 120,
        outputTokens: 80,
        totalTokens: 200,
      },
    };
  },
});
