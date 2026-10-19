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

export const commercialPlanDefinitionSchema = z.object({
  code: commercialPlanSchema,
  name: z.string().min(1),
  monthlyPriceCents: z.number().int().nonnegative(),
  recommended: z.boolean(),
  order: z.number().int().nonnegative(),
  projectLimit: z.number().int().positive().nullable(),
  storageLimitBytes: z.number().int().positive(),
  monthlyAiCredits: z.number().int().nonnegative(),
});

export const commercialPlanListSchema = z.object({
  items: z.array(commercialPlanDefinitionSchema),
});

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

export const billingReturnPathSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^\/(?!\/)[^\\\r\n]*$/);

export const createCheckoutSessionSchema = z.object({
  plan: paidCommercialPlanSchema,
  returnTo: billingReturnPathSchema.optional(),
});

export const createPortalSessionSchema = z
  .object({ returnTo: billingReturnPathSchema.optional() })
  .default({});

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
    plan: CommercialPlan;
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

const commercialSeveritySchema = z.enum(["at_limit", "near_limit", "normal", "over_limit"]);
const billingSubscriptionStatusSchema = z.enum([
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
]);

export const commercialSummarySchema: z.ZodType<CommercialSummary> = z.object({
  plan: commercialPlanSchema,
  entitlementSource: z.enum(["admin", "basic", "stripe"]),
  nextRecommendedPlan: commercialPlanSchema.nullable(),
  projects: z.object({
    used: z.number().int().nonnegative(),
    limit: z.number().int().positive().nullable(),
    remaining: z.number().int().nonnegative().nullable(),
  }),
  storage: z.object({
    usedBytes: z.number().int().nonnegative(),
    reservedBytes: z.number().int().nonnegative(),
    limitBytes: z.number().int().positive(),
    remainingBytes: z.number().int().nonnegative(),
    percentage: z.number().nonnegative(),
    severity: commercialSeveritySchema,
  }),
  credits: z.object({
    available: z.number().int().nonnegative(),
    bonus: z.number().int().nonnegative(),
    legacy: z.number().int().nonnegative(),
    monthly: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    totalSpendable: z.number().int().nonnegative(),
    monthlyAllowance: z.number().int().nonnegative(),
    renewsAt: z.string().datetime().nullable(),
    severity: z.enum(["at_limit", "near_limit", "normal"]),
  }),
  subscription: z
    .object({
      plan: commercialPlanSchema,
      status: billingSubscriptionStatusSchema,
      cancelAtPeriodEnd: z.boolean(),
      currentPeriodEnd: z.string().datetime().nullable(),
      accessUntil: z.string().datetime().nullable(),
    })
    .nullable(),
  capabilities: z.object({
    canCancel: z.boolean(),
    canCreateProject: z.boolean(),
    canGenerate: z.boolean(),
    canOpenBillingPortal: z.boolean(),
    canUpgrade: z.boolean(),
    canUpload: z.boolean(),
  }),
  billingAction: z.enum(["checkout", "portal"]).nullable(),
});

export const billingDestinationSchema = z.object({
  destination: z.enum(["checkout", "portal"]),
  url: z.string().url(),
});

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
