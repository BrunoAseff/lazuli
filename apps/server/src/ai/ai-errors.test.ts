import { describe, expect, it } from "vitest";
import { z } from "zod";

import { normalizeAiError } from "./ai-errors.ts";

describe("AI error normalization", () => {
  it("maps timeouts, provider failures and invalid outputs to stable codes", () => {
    expect(normalizeAiError(new DOMException("timed out", "TimeoutError"))).toMatchObject({
      code: "AI_TIMEOUT",
      retryable: true,
    });
    expect(normalizeAiError({ isRetryable: true, statusCode: 503 })).toMatchObject({
      code: "AI_PROVIDER_UNAVAILABLE",
      retryable: true,
    });
    let validationError: unknown;
    try {
      z.string().parse(42);
    } catch (error) {
      validationError = error;
    }
    expect(normalizeAiError(validationError)).toMatchObject({
      code: "AI_INVALID_OUTPUT",
      retryable: false,
    });
  });

  it("does not expose the provider error message", () => {
    const normalized = normalizeAiError(new Error("secret provider response"));

    expect(normalized.code).toBe("AI_REQUEST_FAILED");
    expect(normalized.message).not.toContain("secret provider response");
  });
});
