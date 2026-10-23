import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";

import type { StripeBillingService } from "../commercial/stripe-billing-service.ts";
import type { Database } from "../database/client.ts";
import {
  accountExport,
  asset,
  billingSubscription,
  documentImport,
  project,
} from "../database/schema/index.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { enqueueLifecycleEmail } from "../email/email-outbox.ts";
import {
  enqueueObjectDeletions,
  processPendingObjectDeletions,
} from "../storage/storage-cleanup.ts";

const BILLABLE_STATUSES = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "paused",
] as const;

export const createAccountDeletionLifecycle = ({
  database,
  logger,
  storage,
  stripe,
}: {
  database: Database;
  logger: FastifyBaseLogger;
  storage: ObjectStorage;
  stripe: StripeBillingService | null;
}) => {
  const pendingObjectKeys = new Map<string, string[]>();

  return {
    async beforeDelete(user: { id: string }) {
      const [subscription] = await database
        .select({ status: billingSubscription.status })
        .from(billingSubscription)
        .where(
          and(
            eq(billingSubscription.userId, user.id),
            inArray(billingSubscription.status, [...BILLABLE_STATUSES]),
          ),
        )
        .limit(1);
      if (subscription && !stripe)
        throw new Error("Billing must be available before deleting a subscribed account");
      await stripe?.cancelForAccountDeletion(user.id);
      await enqueueLifecycleEmail(database, {
        key: `account-deleted/${user.id}`,
        userId: user.id,
        kind: "account_deleted",
        readyWhen: "deleted",
      });

      const [assets, covers, imports, exports] = await Promise.all([
        database.select({ key: asset.objectKey }).from(asset).where(eq(asset.userId, user.id)),
        database
          .select({ key: project.coverKey })
          .from(project)
          .where(and(eq(project.userId, user.id), isNotNull(project.coverKey))),
        database
          .select({ key: documentImport.inputObjectKey })
          .from(documentImport)
          .where(and(eq(documentImport.userId, user.id), isNotNull(documentImport.inputObjectKey))),
        database
          .select({ key: accountExport.objectKey })
          .from(accountExport)
          .where(and(eq(accountExport.userId, user.id), isNotNull(accountExport.objectKey))),
      ]);
      pendingObjectKeys.set(
        user.id,
        [...assets, ...covers, ...imports, ...exports]
          .map(({ key }) => key)
          .filter((key): key is string => Boolean(key)),
      );
    },
    async afterDelete(user: { id: string }) {
      const keys = pendingObjectKeys.get(user.id) ?? [];
      try {
        await enqueueObjectDeletions(database, keys);
        pendingObjectKeys.delete(user.id);
        void processPendingObjectDeletions(database, storage).catch((error: unknown) => {
          logger.error({ err: error, userId: user.id }, "account storage cleanup failed");
        });
      } catch (error) {
        logger.error(
          { err: error, objectCount: keys.length, userId: user.id },
          "account storage cleanup could not be enqueued",
        );
      }
    },
    rollback(userId: string) {
      pendingObjectKeys.delete(userId);
    },
  };
};
