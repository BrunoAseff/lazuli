import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { Transaction } from "../database/client.ts";
import { aiCreditAccount, aiCreditLedger } from "../database/schema/index.ts";

export const lockAiCreditAccount = async (tx: Transaction, userId: string) => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
  await tx.insert(aiCreditAccount).values({ userId }).onConflictDoNothing();
  const [account] = await tx
    .select()
    .from(aiCreditAccount)
    .where(eq(aiCreditAccount.userId, userId))
    .for("update");
  if (!account) throw new Error("AI credit account was not created");
  return account;
};

export const appendAiCreditLedgerEntry = async (
  tx: Transaction,
  input: {
    actorId: string;
    actorType: "admin" | "system" | "user";
    amount: number;
    generationId?: string | null;
    idempotencyKey: string;
    reason: string;
    type: "adjustment" | "consume" | "grant" | "release" | "reserve";
    userId: string;
  },
) => {
  const [entry] = await tx
    .insert(aiCreditLedger)
    .values({ id: randomUUID(), ...input, generationId: input.generationId ?? null })
    .onConflictDoNothing({
      target: [aiCreditLedger.userId, aiCreditLedger.idempotencyKey],
    })
    .returning();
  return entry ?? null;
};

export const updateAiCreditAccount = async (
  tx: Transaction,
  input: { availableDelta: number; reservedDelta: number; userId: string },
) => {
  const [account] = await tx
    .update(aiCreditAccount)
    .set({
      availableBalance: sql`${aiCreditAccount.availableBalance} + ${input.availableDelta}`,
      reservedBalance: sql`${aiCreditAccount.reservedBalance} + ${input.reservedDelta}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiCreditAccount.userId, input.userId),
        sql`${aiCreditAccount.availableBalance} + ${input.availableDelta} >= 0`,
        sql`${aiCreditAccount.reservedBalance} + ${input.reservedDelta} >= 0`,
      ),
    )
    .returning();
  if (!account) throw new Error("AI credit balance update would become negative");
  return account;
};
