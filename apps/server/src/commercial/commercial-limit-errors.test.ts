import type { CommercialSummary } from "@lazuli/shared";
import { describe, expect, it } from "vitest";

import { getCommercialLimitDetails } from "./commercial-limit-errors.ts";

const summary: CommercialSummary = {
  billingAction: "checkout",
  capabilities: {
    canCancel: false,
    canCreateProject: false,
    canGenerate: true,
    canOpenBillingPortal: false,
    canUpgrade: true,
    canUpload: false,
  },
  credits: {
    available: 80,
    bonus: 30,
    legacy: 0,
    monthly: 50,
    monthlyAllowance: 300,
    renewsAt: "2026-11-01T00:00:00.000Z",
    reserved: 10,
    severity: "near_limit",
    totalSpendable: 80,
  },
  entitlementSource: "basic",
  nextRecommendedPlan: "essential",
  plan: "basic",
  projects: { limit: 5, remaining: 0, used: 5 },
  storage: {
    limitBytes: 500,
    percentage: 100,
    remainingBytes: 0,
    reservedBytes: 25,
    severity: "at_limit",
    usedBytes: 475,
  },
  subscription: null,
};

describe("commercial limit details", () => {
  it("describes project usage using the effective entitlement", () => {
    expect(getCommercialLimitDetails(summary, "projects")).toEqual({
      limit: 5,
      nextRecommendedPlan: "essential",
      plan: "basic",
      remaining: 0,
      resource: "projects",
      usage: 5,
    });
  });

  it("includes reserved storage in the committed usage", () => {
    expect(getCommercialLimitDetails(summary, "storage")).toMatchObject({
      limit: 500,
      remaining: 0,
      resource: "storage",
      usage: 500,
    });
  });

  it("reports the spendable credit balance without losing bonuses", () => {
    expect(getCommercialLimitDetails(summary, "credits")).toMatchObject({
      limit: 300,
      remaining: 80,
      resource: "credits",
      usage: 250,
    });
  });
});
