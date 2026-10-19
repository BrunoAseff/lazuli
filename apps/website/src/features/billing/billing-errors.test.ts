import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client.ts";
import { getCommercialLimit } from "./billing-errors.ts";

describe("commercial billing errors", () => {
  it("adapts a structured storage limit response", () => {
    const error = new ApiError(409, "PLAN_STORAGE_LIMIT_REACHED", {
      code: "PLAN_STORAGE_LIMIT_REACHED",
      details: {
        limit: 500,
        nextRecommendedPlan: "essential",
        plan: "basic",
        remaining: 0,
        resource: "storage",
        usage: 500,
      },
    });

    expect(getCommercialLimit(error)).toEqual({
      limit: 500,
      nextRecommendedPlan: "essential",
      plan: "basic",
      remaining: 0,
      resource: "storage",
      usage: 500,
    });
  });

  it("does not reinterpret unrelated API failures as commercial limits", () => {
    expect(getCommercialLimit(new ApiError(500, "INTERNAL_ERROR", {}))).toBeNull();
    expect(getCommercialLimit(new Error("network"))).toBeNull();
  });
});
