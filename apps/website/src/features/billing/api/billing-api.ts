import {
  billingDestinationSchema,
  commercialPlanListSchema,
  commercialSummarySchema,
  createCheckoutSessionSchema,
  createPortalSessionSchema,
  type CommercialPlan,
} from "@lazuli/shared";

import { apiRequest } from "@/lib/api-client.ts";
import { getBillingFixture } from "../billing-fixtures.ts";

export const fetchBillingPlans = (signal?: AbortSignal) =>
  apiRequest("/api/billing/plans", commercialPlanListSchema, { signal });

export const fetchBillingSummary = (signal?: AbortSignal) => {
  const fixture = getBillingFixture();
  return fixture
    ? Promise.resolve(commercialSummarySchema.parse(fixture))
    : apiRequest("/api/billing/summary", commercialSummarySchema, { signal });
};

export const refreshBillingSummary = () => {
  const fixture = getBillingFixture();
  return fixture
    ? Promise.resolve(commercialSummarySchema.parse(fixture))
    : apiRequest("/api/billing/summary/refresh", commercialSummarySchema, { method: "POST" });
};

export const createBillingCheckout = (plan: CommercialPlan, returnTo: string) =>
  apiRequest("/api/billing/checkout-sessions", billingDestinationSchema, {
    body: JSON.stringify(createCheckoutSessionSchema.parse({ plan, returnTo })),
    method: "POST",
  });

export const createBillingPortal = (returnTo: string) =>
  apiRequest("/api/billing/portal-sessions", billingDestinationSchema, {
    body: JSON.stringify(createPortalSessionSchema.parse({ returnTo })),
    method: "POST",
  });
