import type { CommercialLimitDetails, CommercialLimitResource } from "@lazuli/shared";

import { ApiError } from "@/lib/api-client.ts";

const codeToResource: Record<string, CommercialLimitResource> = {
  AI_INSUFFICIENT_CREDITS: "credits",
  PLAN_PROJECT_LIMIT_REACHED: "projects",
  PLAN_STORAGE_LIMIT_REACHED: "storage",
};

export const getCommercialLimit = (error: unknown): CommercialLimitDetails | null => {
  if (!(error instanceof ApiError) || !error.code || !codeToResource[error.code]) return null;
  const payload = error.payload;
  if (!payload || typeof payload !== "object") return null;
  const details = "details" in payload ? payload.details : payload;
  if (!details || typeof details !== "object") return null;
  const record = details as Partial<CommercialLimitDetails>;
  return {
    resource: codeToResource[error.code],
    usage: typeof record.usage === "number" ? record.usage : 0,
    limit: typeof record.limit === "number" ? record.limit : null,
    remaining: typeof record.remaining === "number" ? record.remaining : 0,
    plan: record.plan ?? "basic",
    nextRecommendedPlan: record.nextRecommendedPlan ?? null,
  };
};
