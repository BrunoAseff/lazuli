import { z } from "zod";

export const commercialPlanSchema = z.enum(["basic", "essential", "specialist"]);
export type CommercialPlan = z.infer<typeof commercialPlanSchema>;

export type CommercialPlanDefinition = {
  code: CommercialPlan;
  name: string;
  monthlyPriceCents: number;
  recommended: boolean;
  order: number;
  projectLimit: number | null;
  storageLimitBytes: number;
  monthlyAiCredits: number;
};

export const COMMERCIAL_PLAN_CATALOG = {
  basic: {
    code: "basic",
    name: "Básico",
    monthlyPriceCents: 0,
    order: 0,
    projectLimit: 5,
    recommended: false,
    storageLimitBytes: 500 * 1024 * 1024,
    monthlyAiCredits: 300,
  },
  essential: {
    code: "essential",
    name: "Essencial",
    monthlyPriceCents: 1_490,
    order: 1,
    projectLimit: 20,
    recommended: true,
    storageLimitBytes: 5 * 1024 * 1024 * 1024,
    monthlyAiCredits: 3_000,
  },
  specialist: {
    code: "specialist",
    name: "Especialista",
    monthlyPriceCents: 3_990,
    order: 2,
    projectLimit: null,
    recommended: false,
    storageLimitBytes: 20 * 1024 * 1024 * 1024,
    monthlyAiCredits: 10_000,
  },
} as const satisfies Record<CommercialPlan, CommercialPlanDefinition>;

export const paidCommercialPlanSchema = z.enum(["essential", "specialist"]);

export const createCheckoutSessionSchema = z.object({
  plan: paidCommercialPlanSchema,
});

export type CommercialSeverity = "at_limit" | "near_limit" | "normal" | "over_limit";

export type BillingSubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "paused"
  | "trialing"
  | "unpaid";

export type CommercialSummary = {
  plan: CommercialPlan;
  entitlementSource: "admin" | "basic" | "stripe";
  nextRecommendedPlan: CommercialPlan | null;
  projects: { used: number; limit: number | null; remaining: number | null };
  storage: {
    usedBytes: number;
    reservedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    percentage: number;
    severity: CommercialSeverity;
  };
  credits: {
    available: number;
    bonus: number;
    legacy: number;
    monthly: number;
    reserved: number;
    totalSpendable: number;
    monthlyAllowance: number;
    renewsAt: string | null;
    severity: Exclude<CommercialSeverity, "over_limit">;
  };
  subscription: {
    status: BillingSubscriptionStatus;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    accessUntil: string | null;
  } | null;
  capabilities: {
    canCancel: boolean;
    canCreateProject: boolean;
    canGenerate: boolean;
    canOpenBillingPortal: boolean;
    canUpgrade: boolean;
    canUpload: boolean;
  };
  billingAction: "checkout" | "portal" | null;
};

export type CommercialLimitErrorCode =
  | "AI_INSUFFICIENT_CREDITS"
  | "PLAN_PROJECT_LIMIT_REACHED"
  | "PLAN_STORAGE_LIMIT_REACHED";

export type CommercialLimitResource = "credits" | "projects" | "storage";

export type CommercialLimitDetails = {
  resource: CommercialLimitResource;
  usage: number;
  limit: number | null;
  remaining: number;
  plan: CommercialPlan;
  nextRecommendedPlan: CommercialPlan | null;
};
