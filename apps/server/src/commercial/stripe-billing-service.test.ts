import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { hasScheduledStripeCancellation } from "./stripe-billing-service.ts";

const subscription = (
  overrides: Partial<Pick<Stripe.Subscription, "cancel_at" | "cancel_at_period_end" | "status">>,
) =>
  ({
    cancel_at: null,
    cancel_at_period_end: false,
    status: "active",
    ...overrides,
  }) as Stripe.Subscription;

describe("hasScheduledStripeCancellation", () => {
  it("recognizes the standard cancel-at-period-end representation", () => {
    expect(hasScheduledStripeCancellation(subscription({ cancel_at_period_end: true }))).toBe(true);
  });

  it("recognizes an explicit future cancellation used by the customer portal", () => {
    expect(hasScheduledStripeCancellation(subscription({ cancel_at: 1_795_060_780 }))).toBe(true);
  });

  it("does not report an already canceled subscription as pending cancellation", () => {
    expect(
      hasScheduledStripeCancellation(
        subscription({ cancel_at: 1_795_060_780, status: "canceled" }),
      ),
    ).toBe(false);
  });
});
