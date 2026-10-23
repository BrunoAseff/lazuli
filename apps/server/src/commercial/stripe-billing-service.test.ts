import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import {
  becameActiveSubscription,
  hasScheduledStripeCancellation,
  isManageableStripeSubscription,
  isReusableCheckoutSession,
  selectPreferredStripeSubscription,
} from "./stripe-billing-service.ts";

describe("localized Checkout session reuse", () => {
  const session = {
    locale: "pt-BR",
    mode: "subscription",
    metadata: { lazuliUserId: "owner", plan: "essential" },
    url: "https://checkout.stripe.com/session",
  } as const;

  it("reuses only a localized session for the same owner and plan", () => {
    expect(isReusableCheckoutSession(session, "owner", "essential")).toBe(true);
    expect(isReusableCheckoutSession({ ...session, locale: null }, "owner", "essential")).toBe(
      false,
    );
    expect(isReusableCheckoutSession({ ...session, locale: "en" }, "owner", "essential")).toBe(
      false,
    );
    expect(isReusableCheckoutSession(session, "other", "essential")).toBe(false);
    expect(isReusableCheckoutSession(session, "owner", "specialist")).toBe(false);
    expect(isReusableCheckoutSession({ ...session, url: null }, "owner", "essential")).toBe(false);
  });
});

describe("subscription activation transition", () => {
  it("counts only the first transition into active access", () => {
    const transitionAt = new Date("2026-10-20T12:00:00.000Z");
    const transition = (
      previousStatus: Parameters<typeof becameActiveSubscription>[0]["previousStatus"],
      nextStatus: Parameters<typeof becameActiveSubscription>[0]["nextStatus"],
      previousAccessUntil: Date | null = null,
    ) =>
      becameActiveSubscription({
        nextStatus,
        previousAccessUntil,
        previousStatus,
        transitionAt,
      });
    expect(transition(null, "active")).toBe(true);
    expect(transition("incomplete", "trialing")).toBe(true);
    expect(transition("active", "active")).toBe(false);
    expect(transition("trialing", "active")).toBe(false);
    expect(transition(null, "past_due")).toBe(false);
  });

  it("does not reactivate access that remained available through the grace period", () => {
    const transitionAt = new Date("2026-10-20T12:00:00.000Z");
    expect(
      becameActiveSubscription({
        nextStatus: "active",
        previousAccessUntil: new Date("2026-10-21T12:00:00.000Z"),
        previousStatus: "past_due",
        transitionAt,
      }),
    ).toBe(false);
    expect(
      becameActiveSubscription({
        nextStatus: "active",
        previousAccessUntil: new Date("2026-10-19T12:00:00.000Z"),
        previousStatus: "past_due",
        transitionAt,
      }),
    ).toBe(true);
  });
});

const subscription = (
  overrides: Partial<
    Pick<Stripe.Subscription, "cancel_at" | "cancel_at_period_end" | "created" | "id" | "status">
  >,
) =>
  ({
    cancel_at: null,
    cancel_at_period_end: false,
    created: 1,
    id: "sub_default",
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

describe("Stripe subscription selection", () => {
  it("treats every non-terminal status as manageable", () => {
    for (const status of ["active", "incomplete", "past_due", "paused", "trialing", "unpaid"])
      expect(isManageableStripeSubscription(subscription({ status }))).toBe(true);
    for (const status of ["canceled", "incomplete_expired"])
      expect(isManageableStripeSubscription(subscription({ status }))).toBe(false);
  });

  it("prefers an active subscription over a stored inactive subscription", () => {
    const stored = subscription({ id: "sub_stored", status: "canceled" });
    const active = subscription({ id: "sub_active", status: "active" });
    expect(selectPreferredStripeSubscription([stored, active], stored)).toBe(active);
  });

  it("keeps the stored subscription as fallback before choosing the newest one", () => {
    const stored = subscription({ created: 1, id: "sub_stored", status: "canceled" });
    const newest = subscription({ created: 2, id: "sub_newest", status: "incomplete" });
    expect(selectPreferredStripeSubscription([stored, newest], stored)).toBe(stored);
    expect(selectPreferredStripeSubscription([stored, newest])).toBe(newest);
  });
});
