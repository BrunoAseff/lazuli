import {
  COMMERCIAL_PLAN_CATALOG,
  type CommercialPlan,
  type CommercialSummary,
} from "@lazuli/shared";

export const BILLING_FIXTURE_NAMES = [
  "basic",
  "project-limit",
  "credits-near",
  "credits-zero",
  "storage-89",
  "storage-90",
  "storage-100",
  "storage-over",
  "essential",
  "essential-canceling",
  "specialist",
  "admin",
  "processing",
  "past-due",
  "downgrade-over",
] as const;

export type BillingFixtureName = (typeof BILLING_FIXTURE_NAMES)[number];

const MB = 1024 ** 2;
const planSummary = (plan: CommercialPlan): CommercialSummary => {
  const definition = COMMERCIAL_PLAN_CATALOG[plan];
  const paid = plan !== "basic";
  return {
    plan,
    entitlementSource: paid ? "stripe" : "basic",
    nextRecommendedPlan:
      plan === "basic" ? "essential" : plan === "essential" ? "specialist" : null,
    projects: {
      used: plan === "basic" ? 2 : 8,
      limit: definition.projectLimit,
      remaining:
        definition.projectLimit === null
          ? null
          : Math.max(0, definition.projectLimit - (plan === "basic" ? 2 : 8)),
    },
    storage: {
      usedBytes: 120 * MB,
      reservedBytes: 0,
      limitBytes: definition.storageLimitBytes,
      remainingBytes: definition.storageLimitBytes - 120 * MB,
      percentage: (120 * MB * 100) / definition.storageLimitBytes,
      severity: "normal",
    },
    credits: {
      available: Math.floor(definition.monthlyAiCredits * 0.7),
      bonus: 0,
      legacy: 0,
      monthly: Math.floor(definition.monthlyAiCredits * 0.7),
      reserved: 0,
      totalSpendable: Math.floor(definition.monthlyAiCredits * 0.7),
      monthlyAllowance: definition.monthlyAiCredits,
      renewsAt: "2027-01-15T12:00:00.000Z",
      severity: "normal",
    },
    subscription: paid
      ? {
          plan,
          status: "active",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: "2027-01-15T12:00:00.000Z",
          accessUntil: null,
        }
      : null,
    capabilities: {
      canCancel: paid,
      canCreateProject: true,
      canGenerate: true,
      canOpenBillingPortal: paid,
      canUpgrade: plan !== "specialist",
      canUpload: true,
    },
    billingAction: plan === "specialist" ? "portal" : paid ? "portal" : "checkout",
  };
};

const withStorage = (
  summary: CommercialSummary,
  percentage: number,
  severity: CommercialSummary["storage"]["severity"],
) => {
  const usedBytes = Math.round((summary.storage.limitBytes * percentage) / 100);
  return {
    ...summary,
    storage: {
      ...summary.storage,
      usedBytes,
      remainingBytes: Math.max(0, summary.storage.limitBytes - usedBytes),
      percentage,
      severity,
    },
    capabilities: { ...summary.capabilities, canUpload: percentage < 100 },
  } satisfies CommercialSummary;
};

export const createBillingFixture = (name: BillingFixtureName): CommercialSummary => {
  const basic = planSummary("basic");
  if (name === "basic") return basic;
  if (name === "project-limit")
    return {
      ...basic,
      projects: { used: 5, limit: 5, remaining: 0 },
      capabilities: { ...basic.capabilities, canCreateProject: false },
    };
  if (name === "credits-near" || name === "credits-zero") {
    const available = name === "credits-zero" ? 0 : 20;
    return {
      ...basic,
      credits: {
        ...basic.credits,
        available,
        monthly: available,
        totalSpendable: available,
        severity: name === "credits-zero" ? "at_limit" : "near_limit",
      },
      capabilities: { ...basic.capabilities, canGenerate: available > 0 },
    };
  }
  if (name.startsWith("storage-")) {
    const percentage = name === "storage-over" ? 110 : Number(name.slice("storage-".length));
    return withStorage(
      basic,
      percentage,
      percentage > 100
        ? "over_limit"
        : percentage === 100
          ? "at_limit"
          : percentage >= 90
            ? "near_limit"
            : "normal",
    );
  }
  if (name === "specialist") return planSummary("specialist");
  if (name === "admin") {
    const specialist = planSummary("specialist");
    return {
      ...specialist,
      entitlementSource: "admin",
      subscription: null,
      capabilities: {
        ...specialist.capabilities,
        canCancel: false,
        canOpenBillingPortal: false,
      },
      billingAction: null,
    };
  }
  const essential = planSummary("essential");
  if (name === "essential") return essential;
  if (name === "essential-canceling")
    return {
      ...essential,
      subscription: {
        ...essential.subscription!,
        cancelAtPeriodEnd: true,
        accessUntil: "2027-01-15T12:00:00.000Z",
      },
      capabilities: { ...essential.capabilities, canCancel: false },
    };
  if (name === "processing" || name === "past-due")
    return {
      ...essential,
      subscription: {
        ...essential.subscription!,
        status: name === "processing" ? "incomplete" : "past_due",
      },
    };
  return {
    ...withStorage(basic, 140, "over_limit"),
    projects: { used: 9, limit: 5, remaining: 0 },
    capabilities: {
      ...basic.capabilities,
      canCreateProject: false,
      canUpload: false,
    },
  };
};

export const getBillingFixture = (): CommercialSummary | null => {
  if (!(import.meta.env.DEV || import.meta.env.MODE === "test") || typeof window === "undefined")
    return null;
  const candidate = new URLSearchParams(window.location.search).get("billingFixture");
  return BILLING_FIXTURE_NAMES.includes(candidate as BillingFixtureName)
    ? createBillingFixture(candidate as BillingFixtureName)
    : null;
};
