import type { CommercialSummary } from "@lazuli/shared";

export const PAYMENT_PROBLEM_STATUSES = ["incomplete", "past_due", "unpaid"] as const;

type BillingStateSummary = Pick<CommercialSummary, "entitlementSource" | "plan" | "subscription">;

export const hasBillingPaymentProblem = (summary: BillingStateSummary) =>
  Boolean(
    summary.subscription &&
    PAYMENT_PROBLEM_STATUSES.some((status) => status === summary.subscription?.status),
  );

export const hasScheduledCancellation = (summary: BillingStateSummary) =>
  summary.entitlementSource === "stripe" && summary.subscription?.cancelAtPeriodEnd === true;

export const hasPausedSubscription = (summary: BillingStateSummary) =>
  summary.subscription?.status === "paused";
