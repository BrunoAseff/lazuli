import { randomUUID } from "node:crypto";

import type { CommercialPlan } from "@lazuli/shared";
import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";

import { grantCreditBucket } from "../ai-credits/ai-credit-buckets.ts";
import {
  appendAiCreditLedgerEntry,
  lockAiCreditAccount,
  updateAiCreditAccount,
} from "../ai-credits/ai-credit-transactions.ts";
import type { Database, Transaction } from "../database/client.ts";
import {
  adminPlanGrant,
  aiCreditAccount,
  aiCreditBucket,
  commercialAuditLog,
  user,
} from "../database/schema/index.ts";
import { getAnchoredMonthlyPeriod } from "./commercial-credits.ts";
import { resolveEffectiveEntitlement } from "./commercial-entitlements.ts";
import { createCommercialAudit, getCommercialSummary } from "./commercial-service.ts";

type AuditInput = {
  action: string;
  dryRun?: boolean;
  environment: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  operatorId: string;
  reason: string;
  result?: Record<string, unknown>;
  targetUserId: string;
};

const writeAudit = async (tx: Transaction, input: AuditInput) =>
  (await createCommercialAudit(tx, input))[0] ?? null;

const readCompletedOperation = async (
  tx: Transaction,
  input: Pick<AuditInput, "idempotencyKey" | "operatorId" | "targetUserId">,
) => {
  // The advisory lock makes the audit row an operation-level idempotency guard,
  // including the short interval before the first transaction inserts the row.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`${input.operatorId}:${input.targetUserId}:${input.idempotencyKey}`}))`,
  );
  const [entry] = await tx
    .select({ result: commercialAuditLog.result })
    .from(commercialAuditLog)
    .where(
      and(
        eq(commercialAuditLog.operatorId, input.operatorId),
        eq(commercialAuditLog.targetUserId, input.targetUserId),
        eq(commercialAuditLog.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return entry?.result ?? null;
};

const findUser = async (database: Database, email: string) => {
  const [target] = await database
    .select({ email: user.email, id: user.id, name: user.name })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()))
    .limit(1);
  return target ?? null;
};

const resetMonthlyBuckets = async (
  tx: Transaction,
  input: Omit<AuditInput, "action" | "result" | "targetUserId"> & { userId: string },
) => {
  const now = new Date();
  await lockAiCreditAccount(tx, input.userId);
  const buckets = await tx
    .select()
    .from(aiCreditBucket)
    .where(
      and(
        eq(aiCreditBucket.userId, input.userId),
        eq(aiCreditBucket.origin, "monthly"),
        gt(aiCreditBucket.remainingCredits, 0),
        or(isNull(aiCreditBucket.expiresAt), gt(aiCreditBucket.expiresAt, now)),
      ),
    )
    .orderBy(asc(aiCreditBucket.createdAt), asc(aiCreditBucket.id))
    .for("update");
  let removed = 0;
  for (const bucket of buckets) {
    const amount = bucket.remainingCredits;
    const ledger = await appendAiCreditLedgerEntry(tx, {
      actorId: input.operatorId,
      actorType: "admin",
      amount: -amount,
      bucketId: bucket.id,
      idempotencyKey: `admin-reset:${input.idempotencyKey}:${bucket.id}`,
      reason: input.reason,
      type: "adjustment",
      userId: input.userId,
    });
    if (!ledger) continue;
    await tx
      .update(aiCreditBucket)
      .set({ remainingCredits: 0, updatedAt: now })
      .where(eq(aiCreditBucket.id, bucket.id));
    removed += amount;
  }
  if (removed > 0)
    await updateAiCreditAccount(tx, {
      availableDelta: -removed,
      reservedDelta: 0,
      userId: input.userId,
    });
  const entitlement = await resolveEffectiveEntitlement(tx, input.userId, now);
  const [accountOwner] = await tx
    .select({ createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!accountOwner) throw new Error("User was not found for monthly credit reset");
  const period = getAnchoredMonthlyPeriod(entitlement.periodAnchor ?? accountOwner.createdAt, now);
  const bucket = await grantCreditBucket(tx, {
    actorId: input.operatorId,
    actorType: "admin",
    amount: entitlement.monthlyAiCredits,
    expiresAt: period.end,
    idempotencyKey: `admin-reset:${input.idempotencyKey}:replacement`,
    origin: "monthly",
    plan: entitlement.code,
    reason: input.reason,
    sourceId: input.idempotencyKey,
    startsAt: period.start,
    userId: input.userId,
  });
  const [account] = await tx
    .select()
    .from(aiCreditAccount)
    .where(eq(aiCreditAccount.userId, input.userId));
  return {
    available: account?.availableBalance ?? 0,
    granted: bucket?.totalCredits ?? 0,
    plan: entitlement.code,
    removed,
  };
};

export const createCommercialAdminService = (database: Database, environment: string) => ({
  async findUser(email: string) {
    return findUser(database, email);
  },

  async showUser(email: string) {
    const target = await findUser(database, email);
    if (!target) return null;
    return { user: target, summary: await getCommercialSummary(database, target.id) };
  },

  async addCredits(input: {
    amount: number;
    email: string;
    idempotencyKey: string;
    operatorId: string;
    reason: string;
  }) {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
      throw new Error("Credit amount must be a positive safe integer");
    const target = await findUser(database, input.email);
    if (!target) return null;
    return database.transaction(async (tx) => {
      const completed = await readCompletedOperation(tx, {
        idempotencyKey: input.idempotencyKey,
        operatorId: input.operatorId,
        targetUserId: target.id,
      });
      if (completed) return { result: completed, user: target };
      await lockAiCreditAccount(tx, target.id);
      const bucket = await grantCreditBucket(tx, {
        actorId: input.operatorId,
        actorType: "admin",
        amount: input.amount,
        idempotencyKey: `admin-bonus:${input.idempotencyKey}`,
        origin: "admin_bonus",
        reason: input.reason,
        sourceId: input.idempotencyKey,
        userId: target.id,
      });
      const [account] = await tx
        .select()
        .from(aiCreditAccount)
        .where(eq(aiCreditAccount.userId, target.id));
      const result = {
        amount: bucket?.totalCredits ?? 0,
        available: account?.availableBalance ?? 0,
        created: Boolean(bucket),
      };
      await writeAudit(tx, {
        action: "credits.add",
        environment,
        idempotencyKey: input.idempotencyKey,
        metadata: { amount: input.amount },
        operatorId: input.operatorId,
        reason: input.reason,
        result,
        targetUserId: target.id,
      });
      return { result, user: target };
    });
  },

  async resetCredits(input: {
    email: string;
    idempotencyKey: string;
    operatorId: string;
    reason: string;
  }) {
    const target = await findUser(database, input.email);
    if (!target) return null;
    return database.transaction(async (tx) => {
      const completed = await readCompletedOperation(tx, {
        idempotencyKey: input.idempotencyKey,
        operatorId: input.operatorId,
        targetUserId: target.id,
      });
      if (completed) return { result: completed, user: target };
      const result = await resetMonthlyBuckets(tx, { ...input, userId: target.id, environment });
      await writeAudit(tx, {
        action: "credits.reset",
        environment,
        idempotencyKey: input.idempotencyKey,
        operatorId: input.operatorId,
        reason: input.reason,
        result,
        targetUserId: target.id,
      });
      return { result, user: target };
    });
  },

  async grantPlan(input: {
    email: string;
    endsAt?: Date | null;
    idempotencyKey: string;
    operatorId: string;
    plan: Exclude<CommercialPlan, "basic">;
    reason: string;
    skipIfAlreadyGranted?: boolean;
  }) {
    const target = await findUser(database, input.email);
    if (!target) return null;
    const result = await database.transaction(async (tx) => {
      const completed = await readCompletedOperation(tx, {
        idempotencyKey: input.idempotencyKey,
        operatorId: input.operatorId,
        targetUserId: target.id,
      });
      if (completed) return { ...completed, replayed: true };
      const now = new Date();
      if (input.skipIfAlreadyGranted) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`admin-plan:${target.id}:${input.plan}`}))`,
        );
        const [existingGrant] = await tx
          .select({ id: adminPlanGrant.id })
          .from(adminPlanGrant)
          .where(
            and(
              eq(adminPlanGrant.userId, target.id),
              eq(adminPlanGrant.plan, input.plan),
              isNull(adminPlanGrant.revokedAt),
              lte(adminPlanGrant.startsAt, now),
              or(isNull(adminPlanGrant.endsAt), gt(adminPlanGrant.endsAt, now)),
            ),
          )
          .limit(1)
          .for("update");
        if (existingGrant) {
          const auditResult = {
            alreadyGranted: true,
            created: false,
            endsAt: input.endsAt?.toISOString() ?? null,
            plan: input.plan,
          };
          await writeAudit(tx, {
            action: "plan.grant",
            environment,
            idempotencyKey: input.idempotencyKey,
            metadata: { endsAt: auditResult.endsAt, plan: input.plan },
            operatorId: input.operatorId,
            reason: input.reason,
            result: auditResult,
            targetUserId: target.id,
          });
          return auditResult;
        }
      }
      const [grant] = await tx
        .insert(adminPlanGrant)
        .values({
          id: randomUUID(),
          endsAt: input.endsAt ?? null,
          idempotencyKey: input.idempotencyKey,
          operatorId: input.operatorId,
          plan: input.plan,
          reason: input.reason,
          startsAt: now,
          userId: target.id,
        })
        .onConflictDoNothing({
          target: [adminPlanGrant.operatorId, adminPlanGrant.idempotencyKey],
        })
        .returning();
      if (grant)
        await resetMonthlyBuckets(tx, {
          environment,
          idempotencyKey: `plan-grant:${input.idempotencyKey}`,
          operatorId: input.operatorId,
          reason: input.reason,
          userId: target.id,
        });
      const auditResult = {
        alreadyGranted: false,
        created: Boolean(grant),
        endsAt: input.endsAt?.toISOString() ?? null,
        plan: input.plan,
      };
      await writeAudit(tx, {
        action: "plan.grant",
        environment,
        idempotencyKey: input.idempotencyKey,
        metadata: { endsAt: auditResult.endsAt, plan: input.plan },
        operatorId: input.operatorId,
        reason: input.reason,
        result: auditResult,
        targetUserId: target.id,
      });
      return auditResult;
    });
    return { result, user: target };
  },

  async revokePlan(input: {
    email: string;
    idempotencyKey: string;
    operatorId: string;
    reason: string;
  }) {
    const target = await findUser(database, input.email);
    if (!target) return null;
    const result = await database.transaction(async (tx) => {
      const completed = await readCompletedOperation(tx, {
        idempotencyKey: input.idempotencyKey,
        operatorId: input.operatorId,
        targetUserId: target.id,
      });
      if (completed) return completed;
      const revoked = await tx
        .update(adminPlanGrant)
        .set({ revokedAt: new Date() })
        .where(and(eq(adminPlanGrant.userId, target.id), isNull(adminPlanGrant.revokedAt)))
        .returning({ id: adminPlanGrant.id });
      if (revoked.length > 0)
        await resetMonthlyBuckets(tx, {
          environment,
          idempotencyKey: `plan-revoke:${input.idempotencyKey}`,
          operatorId: input.operatorId,
          reason: input.reason,
          userId: target.id,
        });
      const auditResult = { revoked: revoked.length };
      await writeAudit(tx, {
        action: "plan.revoke",
        environment,
        idempotencyKey: input.idempotencyKey,
        operatorId: input.operatorId,
        reason: input.reason,
        result: auditResult,
        targetUserId: target.id,
      });
      return auditResult;
    });
    return { result, user: target };
  },

  async listUsers() {
    return database
      .select({ email: user.email, id: user.id })
      .from(user)
      .orderBy(asc(user.createdAt), asc(user.id));
  },

  async recordDryRun(input: {
    action: string;
    email: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    operatorId: string;
    reason: string;
  }) {
    const target = await findUser(database, input.email);
    if (!target) return null;
    const result = { simulated: true };
    await database.transaction((tx) =>
      writeAudit(tx, {
        action: input.action,
        dryRun: true,
        environment,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
        operatorId: input.operatorId,
        reason: input.reason,
        result,
        targetUserId: target.id,
      }),
    );
    return { result, user: target };
  },
});

export type CommercialAdminService = ReturnType<typeof createCommercialAdminService>;
