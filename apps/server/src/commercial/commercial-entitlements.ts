import {
  COMMERCIAL_PLAN_CATALOG,
  type CommercialPlan,
  type CommercialPlanDefinition,
} from "@lazuli/shared";
import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import type { QueryExecutor } from "../database/client.ts";
import { adminPlanGrant, billingSubscription } from "../database/schema/index.ts";

const PLAN_RANK: Record<CommercialPlan, number> = { basic: 0, essential: 1, specialist: 2 };
const PAID_ENTITLEMENT_STATUSES = ["active", "trialing", "past_due"] as const;

export type EffectiveEntitlement = CommercialPlanDefinition & {
  source: "admin" | "basic" | "stripe";
  periodAnchor: Date | null;
};

export const resolveEffectiveEntitlement = async (
  executor: QueryExecutor,
  userId: string,
  now = new Date(),
): Promise<EffectiveEntitlement> => {
  const [subscription, grants] = await Promise.all([
    executor
      .select({
        currentPeriodStart: billingSubscription.currentPeriodStart,
        accessUntil: billingSubscription.accessUntil,
        plan: billingSubscription.plan,
        status: billingSubscription.status,
      })
      .from(billingSubscription)
      .where(
        and(
          eq(billingSubscription.userId, userId),
          inArray(billingSubscription.status, [...PAID_ENTITLEMENT_STATUSES]),
          or(isNull(billingSubscription.accessUntil), gt(billingSubscription.accessUntil, now)),
        ),
      )
      .limit(1),
    executor
      .select({ plan: adminPlanGrant.plan, startsAt: adminPlanGrant.startsAt })
      .from(adminPlanGrant)
      .where(
        and(
          eq(adminPlanGrant.userId, userId),
          isNull(adminPlanGrant.revokedAt),
          lte(adminPlanGrant.startsAt, now),
          or(isNull(adminPlanGrant.endsAt), gt(adminPlanGrant.endsAt, now)),
        ),
      )
      .orderBy(desc(adminPlanGrant.createdAt)),
  ]);

  let plan: CommercialPlan = "basic";
  let source: EffectiveEntitlement["source"] = "basic";
  let periodAnchor: Date | null = null;
  const stripePlan = subscription[0]?.plan;
  if (stripePlan && PLAN_RANK[stripePlan] > PLAN_RANK[plan]) {
    plan = stripePlan;
    source = "stripe";
    periodAnchor = subscription[0]?.currentPeriodStart ?? null;
  }
  for (const grant of grants)
    if (PLAN_RANK[grant.plan] > PLAN_RANK[plan]) {
      plan = grant.plan;
      source = "admin";
      periodAnchor = grant.startsAt;
    }

  return { ...COMMERCIAL_PLAN_CATALOG[plan], periodAnchor, source };
};

export const planRank = (plan: CommercialPlan) => PLAN_RANK[plan];
