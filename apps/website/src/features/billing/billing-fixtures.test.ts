import { commercialSummarySchema } from "@lazuli/shared";
import { describe, expect, it } from "vitest";

import { BILLING_FIXTURE_NAMES, createBillingFixture } from "./billing-fixtures.ts";

describe("billing fixtures", () => {
  it.each(BILLING_FIXTURE_NAMES)("keeps %s compatible with the public summary", (name) => {
    expect(() => commercialSummarySchema.parse(createBillingFixture(name))).not.toThrow();
  });

  it("represents every storage boundary without leaking NaN", () => {
    expect(createBillingFixture("storage-89").storage).toMatchObject({
      percentage: 89,
      severity: "normal",
    });
    expect(createBillingFixture("storage-90").storage).toMatchObject({
      percentage: 90,
      severity: "near_limit",
    });
    expect(createBillingFixture("storage-100").storage).toMatchObject({
      percentage: 100,
      severity: "at_limit",
    });
    expect(createBillingFixture("storage-over").storage).toMatchObject({
      percentage: 110,
      severity: "over_limit",
    });
  });
});
