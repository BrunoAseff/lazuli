import type {
  CommercialLimitDetails,
  CommercialLimitErrorCode,
  CommercialLimitResource,
  CommercialSummary,
} from "@lazuli/shared";
import type { FastifyReply } from "fastify";

import type { Database } from "../database/client.ts";
import { getCommercialSummary } from "./commercial-service.ts";

const limitMessages: Record<CommercialLimitErrorCode, string> = {
  AI_INSUFFICIENT_CREDITS: "Você não possui créditos suficientes para esta geração.",
  PLAN_PROJECT_LIMIT_REACHED: "Seu limite de projetos foi atingido.",
  PLAN_STORAGE_LIMIT_REACHED: "Seu limite de armazenamento foi atingido.",
};

const limitResources: Record<CommercialLimitErrorCode, CommercialLimitResource> = {
  AI_INSUFFICIENT_CREDITS: "credits",
  PLAN_PROJECT_LIMIT_REACHED: "projects",
  PLAN_STORAGE_LIMIT_REACHED: "storage",
};

export const getCommercialLimitDetails = (
  summary: CommercialSummary,
  resource: CommercialLimitResource,
): CommercialLimitDetails => {
  const common = {
    nextRecommendedPlan: summary.nextRecommendedPlan,
    plan: summary.plan,
    resource,
  };
  if (resource === "projects")
    return {
      ...common,
      limit: summary.projects.limit,
      remaining: summary.projects.remaining ?? 0,
      usage: summary.projects.used,
    };
  if (resource === "storage")
    return {
      ...common,
      limit: summary.storage.limitBytes,
      remaining: summary.storage.remainingBytes,
      usage: summary.storage.usedBytes + summary.storage.reservedBytes,
    };
  return {
    ...common,
    limit: summary.credits.monthlyAllowance,
    remaining: summary.credits.available,
    usage: Math.max(0, summary.credits.monthlyAllowance - summary.credits.monthly),
  };
};

export const sendCommercialLimitError = async (
  reply: FastifyReply,
  database: Database,
  userId: string,
  code: CommercialLimitErrorCode,
  statusCode = code === "AI_INSUFFICIENT_CREDITS" ? 402 : 409,
) => {
  const summary = await getCommercialSummary(database, userId);
  return reply.status(statusCode).send({
    code,
    details: getCommercialLimitDetails(summary, limitResources[code]),
    message: limitMessages[code],
  });
};
