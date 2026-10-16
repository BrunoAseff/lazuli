import { randomUUID } from "node:crypto";

import { and, asc, eq, gt, lt } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { commercialMaintenanceLease, user } from "../database/schema/index.ts";
import { ensureMonthlyCredits } from "./commercial-credits.ts";
import {
  reconcileStorageAccounts,
  type StorageDivergence,
} from "./commercial-storage-reconciliation.ts";
import type { StripeBillingService } from "./stripe-billing-service.ts";

const LEASE_NAME = "commercial-maintenance";
const LEASE_DURATION_MS = 15 * 60 * 1000;
const USER_BATCH_SIZE = 100;

export const createCommercialMaintenanceService = (
  database: Database,
  stripe: StripeBillingService | null,
) => {
  const ownerId = randomUUID();

  const claimLease = async () => {
    const now = new Date();
    const [lease] = await database
      .insert(commercialMaintenanceLease)
      .values({
        name: LEASE_NAME,
        ownerId,
        leasedUntil: new Date(now.getTime() + LEASE_DURATION_MS),
      })
      .onConflictDoUpdate({
        target: commercialMaintenanceLease.name,
        set: {
          ownerId,
          leasedUntil: new Date(now.getTime() + LEASE_DURATION_MS),
          updatedAt: now,
        },
        setWhere: lt(commercialMaintenanceLease.leasedUntil, now),
      })
      .returning({ ownerId: commercialMaintenanceLease.ownerId });
    return lease?.ownerId === ownerId;
  };

  const releaseLease = async () => {
    await database
      .delete(commercialMaintenanceLease)
      .where(
        and(
          eq(commercialMaintenanceLease.name, LEASE_NAME),
          eq(commercialMaintenanceLease.ownerId, ownerId),
        ),
      );
  };

  const renewLease = async () => {
    const [lease] = await database
      .update(commercialMaintenanceLease)
      .set({ leasedUntil: new Date(Date.now() + LEASE_DURATION_MS), updatedAt: new Date() })
      .where(
        and(
          eq(commercialMaintenanceLease.name, LEASE_NAME),
          eq(commercialMaintenanceLease.ownerId, ownerId),
        ),
      )
      .returning({ ownerId: commercialMaintenanceLease.ownerId });
    if (lease?.ownerId !== ownerId) throw new Error("Commercial maintenance lease was lost");
  };

  const maintainUsers = async () => {
    let cursor = "";
    let allocations = 0;
    let storageDivergenceCount = 0;
    const storageDivergences: StorageDivergence[] = [];
    for (;;) {
      const users = await database
        .select({ id: user.id })
        .from(user)
        .where(cursor ? gt(user.id, cursor) : undefined)
        .orderBy(asc(user.id))
        .limit(USER_BATCH_SIZE);
      if (users.length === 0) break;
      for (const account of users)
        if (await ensureMonthlyCredits(database, account.id)) allocations += 1;
      const batchDivergences = await reconcileStorageAccounts(
        database,
        users.map(({ id }) => id),
        { repair: false },
      );
      storageDivergenceCount += batchDivergences.length;
      storageDivergences.push(...batchDivergences.slice(0, 20 - storageDivergences.length));
      await renewLease();
      cursor = users.at(-1)!.id;
      if (users.length < USER_BATCH_SIZE) break;
    }
    return { allocations, storageDivergenceCount, storageDivergences };
  };

  return {
    async run() {
      if (!(await claimLease())) return null;
      try {
        const userMaintenance = await maintainUsers();
        const retriedWebhooks = stripe ? await stripe.retryPendingEvents() : 0;
        await renewLease();
        const reconciliation = stripe
          ? await stripe.reconcileSubscriptions()
          : { issues: [], reconciled: 0 };
        return {
          monthlyAllocations: userMaintenance.allocations,
          reconciliation,
          retriedWebhooks,
          storageDivergenceCount: userMaintenance.storageDivergenceCount,
          storageDivergences: userMaintenance.storageDivergences,
        };
      } finally {
        await releaseLease();
      }
    },
  };
};

export type CommercialMaintenanceService = ReturnType<typeof createCommercialMaintenanceService>;
