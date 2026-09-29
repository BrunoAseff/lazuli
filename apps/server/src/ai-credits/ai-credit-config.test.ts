import { describe, expect, it } from "vitest";

import {
  AI_CREDITS_PER_MATERIAL,
  AI_FREE_REGENERATIONS,
  calculateAiCreditSettlement,
  estimateAiCredits,
} from "./ai-credit-config.ts";

describe("AI credit policy", () => {
  it("centralizes estimates and the included regeneration allowance", () => {
    expect(AI_CREDITS_PER_MATERIAL).toBe(10);
    expect(AI_FREE_REGENERATIONS).toBe(3);
    expect(estimateAiCredits(5)).toBe(50);
  });

  it("charges only valid delivered items and releases a partial batch remainder", () => {
    expect(calculateAiCreditSettlement(100, 7)).toEqual({ consumed: 70, released: 30 });
  });

  it("never consumes more than the amount reserved", () => {
    expect(calculateAiCreditSettlement(20, 9)).toEqual({ consumed: 20, released: 0 });
    expect(calculateAiCreditSettlement(20, 0)).toEqual({ consumed: 0, released: 20 });
  });
});
