import { and, desc, eq, lt, sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { aiCreditAccount, aiCreditLedger, aiGeneration, user } from "../database/schema/index.ts";
import { AI_CREDIT_RESERVATION_TIMEOUT_MS } from "./ai-credit-config.ts";
import {
  appendAiCreditLedgerEntry,
  lockAiCreditAccount,
  updateAiCreditAccount,
} from "./ai-credit-transactions.ts";

const assertAdministrativeEntry = (input: {
  amount: number;
  idempotencyKey: string;
  operatorId: string;
  reason: string;
}) => {
  if (!Number.isSafeInteger(input.amount) || input.amount === 0)
    throw new Error("AI credit amount must be a non-zero safe integer");
  if (!input.idempotencyKey.trim() || !input.operatorId.trim() || !input.reason.trim())
    throw new Error("AI credit administrative metadata is required");
};

export const createAiCreditService = (database: Database) => ({
  async adjust(input: {
    amount: number;
    idempotencyKey: string;
    operatorId: string;
    reason: string;
    userId: string;
  }) {
    assertAdministrativeEntry(input);
    return database.transaction(async (tx) => {
      await lockAiCreditAccount(tx, input.userId);
      const entry = await appendAiCreditLedgerEntry(tx, {
        actorId: input.operatorId,
        actorType: "admin",
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
        type: "adjustment",
        userId: input.userId,
      });
      if (entry)
        await updateAiCreditAccount(tx, {
          availableDelta: input.amount,
          reservedDelta: 0,
          userId: input.userId,
        });
      const [account] = await tx
        .select()
        .from(aiCreditAccount)
        .where(eq(aiCreditAccount.userId, input.userId));
      if (!account) throw new Error("AI credit account was not found after adjustment");
      return { account, created: Boolean(entry) };
    });
  },

  async getBalance(userId: string) {
    const [account] = await database
      .select({
        available: aiCreditAccount.availableBalance,
        reserved: aiCreditAccount.reservedBalance,
      })
      .from(aiCreditAccount)
      .where(eq(aiCreditAccount.userId, userId));
    return account ?? { available: 0, reserved: 0 };
  },

  async listLedger(userId: string, input: { page: number; pageSize: number }) {
    const offset = (input.page - 1) * input.pageSize;
    const [items, total] = await Promise.all([
      database
        .select({
          amount: aiCreditLedger.amount,
          createdAt: aiCreditLedger.createdAt,
          generationId: aiCreditLedger.generationId,
          id: aiCreditLedger.id,
          reason: aiCreditLedger.reason,
          type: aiCreditLedger.type,
        })
        .from(aiCreditLedger)
        .where(eq(aiCreditLedger.userId, userId))
        .orderBy(desc(aiCreditLedger.createdAt), desc(aiCreditLedger.id))
        .limit(input.pageSize)
        .offset(offset),
      database
        .select({ value: sql<number>`count(*)::int` })
        .from(aiCreditLedger)
        .where(eq(aiCreditLedger.userId, userId)),
    ]);
    return { items, totalItems: total[0]?.value ?? 0 };
  },

  async grant(input: {
    amount: number;
    email?: string;
    idempotencyKey: string;
    operatorId: string;
    reason: string;
    userId?: string;
  }) {
    assertAdministrativeEntry(input);
    if (input.amount < 0) throw new Error("AI credit grants must be positive");
    if ((!input.email && !input.userId) || (input.email && input.userId))
      return { kind: "invalid-target" as const };
    const [target] = await database
      .select({ id: user.id })
      .from(user)
      .where(input.userId ? eq(user.id, input.userId) : eq(user.email, input.email ?? ""))
      .limit(1);
    if (!target) return { kind: "user-not-found" as const };

    return database.transaction(async (tx) => {
      await lockAiCreditAccount(tx, target.id);
      const [existing] = await tx
        .select({ id: aiCreditLedger.id })
        .from(aiCreditLedger)
        .where(
          and(
            eq(aiCreditLedger.userId, target.id),
            eq(aiCreditLedger.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (!existing) {
        await appendAiCreditLedgerEntry(tx, {
          actorId: input.operatorId,
          actorType: "admin",
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          reason: input.reason,
          type: "grant",
          userId: target.id,
        });
        await updateAiCreditAccount(tx, {
          availableDelta: input.amount,
          reservedDelta: 0,
          userId: target.id,
        });
      }
      const [account] = await tx
        .select()
        .from(aiCreditAccount)
        .where(eq(aiCreditAccount.userId, target.id));
      if (!account) throw new Error("AI credit account was not found after grant");
      return { account, created: !existing, kind: "granted" as const, userId: target.id };
    });
  },

  async reconcileStaleReservations(now = new Date()) {
    const staleBefore = new Date(now.getTime() - AI_CREDIT_RESERVATION_TIMEOUT_MS);
    const stale = await database
      .select({ id: aiGeneration.id, userId: aiGeneration.userId })
      .from(aiGeneration)
      .where(and(eq(aiGeneration.status, "running"), lt(aiGeneration.startedAt, staleBefore)))
      .limit(100);
    let released = 0;
    for (const operation of stale) {
      const didRelease = await database.transaction(async (tx) => {
        await lockAiCreditAccount(tx, operation.userId);
        const [generation] = await tx
          .select()
          .from(aiGeneration)
          .where(
            and(
              eq(aiGeneration.id, operation.id),
              eq(aiGeneration.userId, operation.userId),
              eq(aiGeneration.status, "running"),
            ),
          )
          .for("update");
        if (!generation) return false;
        if (generation.reservedCredits > 0) {
          const entry = await appendAiCreditLedgerEntry(tx, {
            actorId: "ai-credit-reconciler",
            actorType: "system",
            amount: generation.reservedCredits,
            generationId: generation.id,
            idempotencyKey: `generation:${generation.id}:stale-release`,
            reason: "Liberação de reserva expirada",
            type: "release",
            userId: generation.userId,
          });
          if (entry)
            await updateAiCreditAccount(tx, {
              availableDelta: generation.reservedCredits,
              reservedDelta: -generation.reservedCredits,
              userId: generation.userId,
            });
        }
        await tx
          .update(aiGeneration)
          .set({
            errorCode: "AI_REQUEST_FAILED",
            finishedAt: now,
            reservedCredits: 0,
            status: "failed",
          })
          .where(eq(aiGeneration.id, generation.id));
        return true;
      });
      if (didRelease) released += 1;
    }
    return released;
  },

  async findDivergentAccounts() {
    const rows = await database.execute<{
      available_balance: number;
      calculated_available: number;
      calculated_reserved: number;
      reserved_balance: number;
      user_id: string;
    }>(sql`
      select
        account.user_id,
        account.available_balance,
        account.reserved_balance,
        coalesce(sum(case
          when ledger.type in ('grant', 'adjustment') then ledger.amount
          when ledger.type = 'reserve' then -ledger.amount
          when ledger.type = 'release' then ledger.amount
          else 0
        end), 0)::int as calculated_available,
        coalesce(sum(case
          when ledger.type = 'reserve' then ledger.amount
          when ledger.type in ('consume', 'release') then -ledger.amount
          else 0
        end), 0)::int as calculated_reserved
      from ai_credit_account account
      left join ai_credit_ledger ledger on ledger.user_id = account.user_id
      group by account.user_id, account.available_balance, account.reserved_balance
      having
        account.available_balance <> coalesce(sum(case
          when ledger.type in ('grant', 'adjustment') then ledger.amount
          when ledger.type = 'reserve' then -ledger.amount
          when ledger.type = 'release' then ledger.amount
          else 0
        end), 0)::int
        or account.reserved_balance <> coalesce(sum(case
          when ledger.type = 'reserve' then ledger.amount
          when ledger.type in ('consume', 'release') then -ledger.amount
          else 0
        end), 0)::int
      limit 100
    `);
    return [...rows];
  },
});

export type AiCreditService = ReturnType<typeof createAiCreditService>;
