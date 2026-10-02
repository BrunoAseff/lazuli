import { describe, expect, it } from "vitest";

import type { ServerEnv } from "../config.ts";
import { createOpenAiProvider } from "./openai-provider.ts";

const env = {
  AI_GENERATION_TIMEOUT_MS: 45_000,
  AI_MODEL: "gpt-6-luna",
  AI_REAL_CALLS_ENABLED: false,
} as ServerEnv;

describe("OpenAI provider", () => {
  it("cannot be constructed unless real calls were explicitly enabled", () => {
    expect(() => createOpenAiProvider(env)).toThrowError(
      expect.objectContaining({ code: "AI_CONFIGURATION_ERROR" }),
    );
  });
});
