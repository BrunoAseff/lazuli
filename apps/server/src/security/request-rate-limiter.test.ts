import { describe, expect, it } from "vitest";

import { createRequestRateLimiter } from "./request-rate-limiter.ts";

describe("request rate limiter", () => {
  it("limits a key during the window and allows it after reset", () => {
    const limiter = createRequestRateLimiter({ limit: 2, windowMs: 1_000 });

    expect(limiter.consume("user", 0)).toBe(true);
    expect(limiter.consume("user", 1)).toBe(true);
    expect(limiter.consume("user", 2)).toBe(false);
    expect(limiter.consume("user", 1_000)).toBe(true);
  });

  it("keeps counters isolated by key", () => {
    const limiter = createRequestRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.consume("user-a", 0)).toBe(true);
    expect(limiter.consume("user-a", 1)).toBe(false);
    expect(limiter.consume("user-b", 1)).toBe(true);
  });
});
