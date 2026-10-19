import { randomUUID } from "node:crypto";

import {
  AI_CREDITS_PER_ITEM,
  COMMERCIAL_PLAN_CATALOG,
  type BillingSubscriptionStatus,
  type CommercialPlan,
  type CommercialSummary,
} from "@lazuli/shared";
import { and, count, eq, gt, isNull, or, sql } from "drizzle-orm";

import { ensureMonthlyCredits, getAnchoredMonthlyPeriod } from "./commercial-credits.ts";
import { resolveEffectiveEntitlement } from "./commercial-entitlements.ts";
import type { Database, QueryExecutor } from "../database/client.ts";
import {
  aiCreditAccount,
  aiCreditBucket,
  billingSubscription,
  commercialAuditLog,
  project,
  userStorage,
  user,
} from "../database/schema/index.ts";

const severityForStorage = (used: number, reserved: number, limit: number) => {
  const committed = used + reserved;
  if (committed > limit) return "over_limit" as const;
  if (committed >= limit) return "at_limit" as const;
  if (committed / limit >= 0.9) return "near_limit" as const;
  return "normal" as const;
};

const severityForCredits = (available: number, allowance: number) => {
  if (available < AI_CREDITS_PER_ITEM) return "at_limit" as const;
  if (available <= Math.min(Math.ceil(allowance * 0.1), 100)) return "near_limit" as const;
  return "normal" as const;
};

export const getCommercialSummary = async (
  database: Database,
  userId: string,
): Promise<CommercialSummary> => {
  await ensureMonthlyCredits(database, userId);
  const now = new Date();
  const [entitlement, projectUsage, storageUsage, credits, subscription, buckets, accountOwner] =
    await Promise.all([
      resolveEffectiveEntitlement(database, userId),
      database
        .select({ value: count() })
        .from(project)
        .where(and(eq(project.userId, userId), eq(project.quotaExempt, false))),
      database.select().from(userStorage).where(eq(userStorage.userId, userId)).limit(1),
      database.select().from(aiCreditAccount).where(eq(aiCreditAccount.userId, userId)).limit(1),
      database
        .select()
        .from(billingSubscription)
        .where(eq(billingSubscription.userId, userId))
        .limit(1),
      database
        .select({
          bonus: sql<number>`coalesce(sum(case when ${aiCreditBucket.origin} = 'admin_bonus' then ${aiCreditBucket.remainingCredits} else 0 end), 0)::int`,
          legacy: sql<number>`coalesce(sum(case when ${aiCreditBucket.origin} = 'legacy' then ${aiCreditBucket.remainingCredits} else 0 end), 0)::int`,
          monthly: sql<number>`coalesce(sum(case when ${aiCreditBucket.origin} = 'monthly' then ${aiCreditBucket.remainingCredits} else 0 end), 0)::int`,
        })
        .from(aiCreditBucket)
        .where(
          and(
            eq(aiCreditBucket.userId, userId),
            gt(aiCreditBucket.remainingCredits, 0),
            or(isNull(aiCreditBucket.expiresAt), gt(aiCreditBucket.expiresAt, now)),
          ),
        ),
      database.select({ createdAt: user.createdAt }).from(user).where(eq(user.id, userId)).limit(1),
    ]);
  const currentSubscription = subscription[0];
  const usedBytes = storageUsage[0]?.usedBytes ?? 0;
  const reservedBytes = storageUsage[0]?.reservedBytes ?? 0;
  const storageCommitted = usedBytes + reservedBytes;
  const creditBalance = credits[0]?.availableBalance ?? 0;
  const bucketBalance = buckets[0] ?? { bonus: 0, legacy: 0, monthly: 0 };
  const renewsAt =
    entitlement.source === "stripe"
      ? currentSubscription?.currentPeriodEnd
      : getAnchoredMonthlyPeriod(entitlement.periodAnchor ?? accountOwner[0]?.createdAt ?? now, now)
          .end;
  const nextRecommendedPlan =
    entitlement.code === "basic"
      ? "essential"
      : entitlement.code === "essential"
        ? "specialist"
        : null;
  const canCreateProject =
    entitlement.projectLimit === null || (projectUsage[0]?.value ?? 0) < entitlement.projectLimit;
  const canUpload = storageCommitted < entitlement.storageLimitBytes;
  const subscriptionCanBeManaged = Boolean(
    currentSubscription && !["canceled", "incomplete_expired"].includes(currentSubscription.status),
  );
  return {
    plan: entitlement.code,
    entitlementSource: entitlement.source,
    nextRecommendedPlan,
    projects: {
      used: projectUsage[0]?.value ?? 0,
      limit: entitlement.projectLimit,
      remaining:
        entitlement.projectLimit === null
          ? null
          : Math.max(0, entitlement.projectLimit - (projectUsage[0]?.value ?? 0)),
    },
    storage: {
      usedBytes,
      reservedBytes,
      limitBytes: entitlement.storageLimitBytes,
      remainingBytes: Math.max(0, entitlement.storageLimitBytes - storageCommitted),
      percentage: Math.min(100, (storageCommitted / entitlement.storageLimitBytes) * 100),
      severity: severityForStorage(usedBytes, reservedBytes, entitlement.storageLimitBytes),
    },
    credits: {
      available: creditBalance,
      bonus: bucketBalance.bonus,
      legacy: bucketBalance.legacy,
      monthly: bucketBalance.monthly,
      reserved: credits[0]?.reservedBalance ?? 0,
      totalSpendable: creditBalance,
      monthlyAllowance: entitlement.monthlyAiCredits,
      renewsAt: renewsAt?.toISOString() ?? null,
      severity: severityForCredits(creditBalance, entitlement.monthlyAiCredits),
    },
    subscription: currentSubscription
      ? {
          plan: currentSubscription.plan as CommercialPlan,
          status: currentSubscription.status as BillingSubscriptionStatus,
          cancelAtPeriodEnd: currentSubscription.cancelAtPeriodEnd,
          currentPeriodEnd: currentSubscription.currentPeriodEnd?.toISOString() ?? null,
          accessUntil: currentSubscription.accessUntil?.toISOString() ?? null,
        }
      : null,
    capabilities: {
      canCancel: Boolean(subscriptionCanBeManaged && !currentSubscription?.cancelAtPeriodEnd),
      canCreateProject,
      canGenerate: creditBalance >= AI_CREDITS_PER_ITEM,
      canOpenBillingPortal: Boolean(currentSubscription),
      canUpgrade: nextRecommendedPlan !== null,
      canUpload,
    },
    billingAction: subscriptionCanBeManaged ? "portal" : nextRecommendedPlan ? "checkout" : null,
  };
};

export const getStorageLimitBytes = async (database: QueryExecutor, userId: string) =>
  (await resolveEffectiveEntitlement(database, userId)).storageLimitBytes;

export const getPlanDefinition = (plan: CommercialPlan) => COMMERCIAL_PLAN_CATALOG[plan];

export const createCommercialAudit = async (
  database: QueryExecutor,
  input: {
    action: string;
    dryRun?: boolean;
    environment: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    operatorId: string;
    reason: string;
    result?: Record<string, unknown>;
    targetUserId: string;
  },
) => {
  return database
    .insert(commercialAuditLog)
    .values({
      id: randomUUID(),
      ...input,
      dryRun: input.dryRun ?? false,
      metadata: input.metadata ?? {},
      result: input.result ?? null,
    })
    .onConflictDoNothing({
      target: [
        commercialAuditLog.operatorId,
        commercialAuditLog.targetUserId,
        commercialAuditLog.idempotencyKey,
      ],
    })
    .returning({ id: commercialAuditLog.id });
};
