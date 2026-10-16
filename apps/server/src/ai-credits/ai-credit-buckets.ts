import { randomUUID } from "node:crypto";

import { and, asc, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import type { Transaction } from "../database/client.ts";
import {
  aiCreditAccount,
  aiCreditBucket,
  aiCreditReservationAllocation,
} from "../database/schema/index.ts";
import { appendAiCreditLedgerEntry, updateAiCreditAccount } from "./ai-credit-transactions.ts";

export const grantCreditBucket = async (
  tx: Transaction,
  input: {
    actorId: string;
    actorType: "admin" | "system";
    amount: number;
    expiresAt?: Date | null;
    idempotencyKey: string;
    origin: "admin_bonus" | "legacy" | "monthly" | "purchase";
    plan?: string | null;
    reason: string;
    sourceId?: string | null;
    startsAt?: Date;
    userId: string;
  },
) => {
  const [bucket] = await tx
    .insert(aiCreditBucket)
    .values({
      id: randomUUID(),
      userId: input.userId,
      origin: input.origin,
      plan: input.plan ?? null,
      totalCredits: input.amount,
      remainingCredits: input.amount,
      startsAt: input.startsAt ?? new Date(),
      expiresAt: input.expiresAt ?? null,
      sourceId: input.sourceId ?? null,
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing({
      target: [aiCreditBucket.userId, aiCreditBucket.idempotencyKey],
    })
    .returning();
  if (!bucket) return null;
  const entry = await appendAiCreditLedgerEntry(tx, {
    actorId: input.actorId,
    actorType: input.actorType,
    amount: input.amount,
    bucketId: bucket.id,
    idempotencyKey: `bucket:${bucket.id}:grant`,
    reason: input.reason,
    type: "grant",
    userId: input.userId,
  });
  if (!entry) throw new Error("AI credit bucket ledger entry was not created");
  await updateAiCreditAccount(tx, {
    availableDelta: input.amount,
    reservedDelta: 0,
    userId: input.userId,
  });
  return bucket;
};

/**
 * Expires monthly allocations without touching bonus or legacy credits.
 * The caller must hold the account lock so the bucket and aggregate balance
 * cannot diverge from a concurrent reservation.
 */
export const expireCreditBuckets = async (tx: Transaction, userId: string, now = new Date()) => {
  const expired = await tx
    .select()
    .from(aiCreditBucket)
    .where(
      and(
        eq(aiCreditBucket.userId, userId),
        eq(aiCreditBucket.origin, "monthly"),
        gt(aiCreditBucket.remainingCredits, 0),
        isNotNull(aiCreditBucket.expiresAt),
        lte(aiCreditBucket.expiresAt, now),
      ),
    )
    .orderBy(asc(aiCreditBucket.createdAt), asc(aiCreditBucket.id))
    .for("update");
  let removed = 0;
  for (const bucket of expired) {
    const entry = await appendAiCreditLedgerEntry(tx, {
      actorId: "monthly-credit-expiration",
      actorType: "system",
      amount: -bucket.remainingCredits,
      bucketId: bucket.id,
      idempotencyKey: `bucket:${bucket.id}:expire`,
      reason: "Expiração de créditos mensais não utilizados",
      type: "adjustment",
      userId,
    });
    if (!entry) continue;
    await tx
      .update(aiCreditBucket)
      .set({ remainingCredits: 0, updatedAt: now })
      .where(eq(aiCreditBucket.id, bucket.id));
    removed += bucket.remainingCredits;
  }
  if (removed > 0)
    await updateAiCreditAccount(tx, {
      availableDelta: -removed,
      reservedDelta: 0,
      userId,
    });
  return removed;
};

export const reserveCreditBuckets = async (
  tx: Transaction,
  input: { amount: number; generationId: string; userId: string },
) => {
  if (input.amount === 0) return true;
  const now = new Date();
  const buckets = await tx
    .select()
    .from(aiCreditBucket)
    .where(
      and(
        eq(aiCreditBucket.userId, input.userId),
        gt(aiCreditBucket.remainingCredits, 0),
        lte(aiCreditBucket.startsAt, now),
        or(isNull(aiCreditBucket.expiresAt), gt(aiCreditBucket.expiresAt, now)),
      ),
    )
    .orderBy(
      sql`${aiCreditBucket.expiresAt} asc nulls last`,
      asc(aiCreditBucket.createdAt),
      asc(aiCreditBucket.id),
    )
    .for("update");
  let remaining = input.amount;
  for (const bucket of buckets) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, bucket.remainingCredits);
    await tx
      .update(aiCreditBucket)
      .set({
        remainingCredits: sql`${aiCreditBucket.remainingCredits} - ${amount}`,
        updatedAt: now,
      })
      .where(eq(aiCreditBucket.id, bucket.id));
    await tx.insert(aiCreditReservationAllocation).values({
      generationId: input.generationId,
      bucketId: bucket.id,
      amount,
    });
    remaining -= amount;
  }
  if (remaining > 0) throw new Error("AI credit buckets do not cover the aggregate balance");
  return true;
};

export const settleCreditBuckets = async (
  tx: Transaction,
  input: { generationId: string; released: number; userId: string },
) => {
  const now = new Date();
  const allocations = await tx
    .select()
    .from(aiCreditReservationAllocation)
    .where(eq(aiCreditReservationAllocation.generationId, input.generationId))
    .orderBy(
      asc(aiCreditReservationAllocation.createdAt),
      asc(aiCreditReservationAllocation.bucketId),
    )
    .for("update");
  let releaseRemaining = input.released;
  let restored = 0;
  for (const allocation of [...allocations].reverse()) {
    if (releaseRemaining <= 0) break;
    const amount = Math.min(releaseRemaining, allocation.amount);
    const returned = await tx
      .update(aiCreditBucket)
      .set({
        remainingCredits: sql`${aiCreditBucket.remainingCredits} + ${amount}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(aiCreditBucket.id, allocation.bucketId),
          or(isNull(aiCreditBucket.expiresAt), gt(aiCreditBucket.expiresAt, now)),
        ),
      )
      .returning({ id: aiCreditBucket.id });
    if (returned.length === 1) restored += amount;
    releaseRemaining -= amount;
  }
  if (releaseRemaining > 0) {
    // Covers reservations created before bucket accounting was introduced.
    const [legacyBucket] = await tx
      .insert(aiCreditBucket)
      .values({
        id: randomUUID(),
        userId: input.userId,
        origin: "legacy",
        plan: null,
        totalCredits: releaseRemaining,
        remainingCredits: releaseRemaining,
        startsAt: now,
        expiresAt: null,
        sourceId: input.generationId,
        idempotencyKey: `legacy-release:${input.generationId}`,
      })
      .onConflictDoNothing({
        target: [aiCreditBucket.userId, aiCreditBucket.idempotencyKey],
      })
      .returning({ id: aiCreditBucket.id });
    if (legacyBucket) restored += releaseRemaining;
  }
  const expired = input.released - restored;
  if (expired > 0)
    await appendAiCreditLedgerEntry(tx, {
      actorId: "monthly-credit-expiration",
      actorType: "system",
      amount: -expired,
      generationId: input.generationId,
      idempotencyKey: `generation:${input.generationId}:expired-release`,
      reason: "Reserva liberada após o vencimento da franquia mensal",
      type: "adjustment",
      userId: input.userId,
    });
  await tx
    .delete(aiCreditReservationAllocation)
    .where(eq(aiCreditReservationAllocation.generationId, input.generationId));
  return restored;
};

export const getBucketBalance = async (tx: Transaction, userId: string) => {
  const now = new Date();
  const [result] = await tx
    .select({ value: sql<number>`coalesce(sum(${aiCreditBucket.remainingCredits}), 0)::int` })
    .from(aiCreditBucket)
    .where(
      and(
        eq(aiCreditBucket.userId, userId),
        gt(aiCreditBucket.remainingCredits, 0),
        lte(aiCreditBucket.startsAt, now),
        or(isNull(aiCreditBucket.expiresAt), gt(aiCreditBucket.expiresAt, now)),
      ),
    );
  const [account] = await tx
    .select()
    .from(aiCreditAccount)
    .where(eq(aiCreditAccount.userId, userId));
  return { bucketAvailable: result?.value ?? 0, account };
};
