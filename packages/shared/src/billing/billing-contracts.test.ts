import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_PLAN_CATALOG,
  createCheckoutSessionSchema,
  paidCommercialPlanSchema,
} from "./billing-contracts.ts";

describe("commercial billing contracts", () => {
  it("keeps the approved plans and limits in one public catalog", () => {
    expect(COMMERCIAL_PLAN_CATALOG).toEqual({
      basic: expect.objectContaining({
        monthlyAiCredits: 300,
        monthlyPriceCents: 0,
        projectLimit: 5,
        storageLimitBytes: 500 * 1024 * 1024,
      }),
      essential: expect.objectContaining({
        monthlyAiCredits: 3_000,
        monthlyPriceCents: 1_490,
        projectLimit: 20,
        storageLimitBytes: 5 * 1024 * 1024 * 1024,
      }),
      specialist: expect.objectContaining({
        monthlyAiCredits: 10_000,
        monthlyPriceCents: 3_990,
        projectLimit: null,
        storageLimitBytes: 20 * 1024 * 1024 * 1024,
      }),
    });
  });

  it("allows Checkout only for paid plans", () => {
    expect(paidCommercialPlanSchema.safeParse("basic").success).toBe(false);
    expect(createCheckoutSessionSchema.safeParse({ plan: "basic" }).success).toBe(false);
    expect(createCheckoutSessionSchema.parse({ plan: "essential" })).toEqual({
      plan: "essential",
    });
    expect(createCheckoutSessionSchema.parse({ plan: "specialist" })).toEqual({
      plan: "specialist",
    });
  });
});
