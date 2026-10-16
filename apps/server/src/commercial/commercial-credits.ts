import { COMMERCIAL_PLAN_CATALOG } from "@lazuli/shared";
import { and, eq, gte, lt } from "drizzle-orm";

import type { Database, Transaction } from "../database/client.ts";
import { aiCreditBucket, user } from "../database/schema/index.ts";
import { expireCreditBuckets, grantCreditBucket } from "../ai-credits/ai-credit-buckets.ts";
import { lockAiCreditAccount } from "../ai-credits/ai-credit-transactions.ts";
import { resolveEffectiveEntitlement } from "./commercial-entitlements.ts";

const addUtcMonthsClamped = (date: Date, months: number, anchorDay: number) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay), 0, 0, 0, 0));
};

export const getAnchoredMonthlyPeriod = (createdAt: Date, now: Date) => {
  const anchorDay = createdAt.getUTCDate();
  let start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      Math.min(
        anchorDay,
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate(),
      ),
    ),
  );
  if (start > now) start = addUtcMonthsClamped(start, -1, anchorDay);
  return { start, end: addUtcMonthsClamped(start, 1, anchorDay) };
};

export const ensureMonthlyCreditsInTransaction = async (
  tx: Transaction,
  userId: string,
  now = new Date(),
) => {
  await expireCreditBuckets(tx, userId, now);
  const entitlement = await resolveEffectiveEntitlement(tx, userId, now);
  if (entitlement.source === "stripe") return null;
  const [accountOwner] = await tx
    .select({ createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!accountOwner) throw new Error("User was not found for monthly credit allocation");
  const period = getAnchoredMonthlyPeriod(entitlement.periodAnchor ?? accountOwner.createdAt, now);
  const [existing] = await tx
    .select({ id: aiCreditBucket.id })
    .from(aiCreditBucket)
    .where(
      and(
        eq(aiCreditBucket.userId, userId),
        eq(aiCreditBucket.origin, "monthly"),
        eq(aiCreditBucket.plan, entitlement.code),
        gte(aiCreditBucket.startsAt, period.start),
        lt(aiCreditBucket.startsAt, period.end),
      ),
    )
    .limit(1);
  if (existing) return null;
  return grantCreditBucket(tx, {
    actorId: "monthly-credit-allocator",
    actorType: "system",
    amount: entitlement.monthlyAiCredits,
    expiresAt: period.end,
    idempotencyKey: `monthly:${entitlement.source}:${entitlement.code}:${period.start.toISOString()}`,
    origin: "monthly",
    plan: entitlement.code,
    reason: `Créditos mensais do plano ${COMMERCIAL_PLAN_CATALOG[entitlement.code].name}`,
    sourceId: period.start.toISOString(),
    startsAt: period.start,
    userId,
  });
};

export const ensureMonthlyCredits = async (database: Database, userId: string, now = new Date()) =>
  database.transaction(async (tx) => {
    await lockAiCreditAccount(tx, userId);
    return ensureMonthlyCreditsInTransaction(tx, userId, now);
  });

// Compatibility aliases for callers introduced before administrative plans existed.
export const ensureBasicMonthlyCredits = ensureMonthlyCredits;
export const ensureBasicMonthlyCreditsInTransaction = ensureMonthlyCreditsInTransaction;
