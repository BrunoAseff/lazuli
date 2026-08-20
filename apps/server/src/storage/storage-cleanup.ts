import { asc, eq, inArray, lte } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { storageObjectDeletion } from "../database/schema/index.ts";
import type { ObjectStorage } from "./object-storage.ts";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const enqueueObjectDeletions = async (
  database: Database | Transaction,
  objectKeys: string[],
  delayMs = 0,
) => {
  const uniqueKeys = [...new Set(objectKeys.filter(Boolean))];
  if (!uniqueKeys.length) return;
  const availableAt = new Date(Date.now() + delayMs);
  await database
    .insert(storageObjectDeletion)
    .values(uniqueKeys.map((objectKey) => ({ objectKey, availableAt })))
    .onConflictDoUpdate({
      target: storageObjectDeletion.objectKey,
      set: { availableAt, updatedAt: new Date() },
    });
};

export const processPendingObjectDeletions = async (
  database: Database,
  storage: ObjectStorage,
  limit = 50,
) => {
  const pending = await database
    .select()
    .from(storageObjectDeletion)
    .where(lte(storageObjectDeletion.availableAt, new Date()))
    .orderBy(asc(storageObjectDeletion.availableAt), asc(storageObjectDeletion.createdAt))
    .limit(limit);
  const deleted: string[] = [];
  for (const item of pending) {
    try {
      await storage.delete(item.objectKey);
      deleted.push(item.objectKey);
    } catch (error) {
      const attempts = item.attempts + 1;
      await database
        .update(storageObjectDeletion)
        .set({
          attempts,
          availableAt: new Date(Date.now() + Math.min(60 * 60_000, 2 ** attempts * 1_000)),
          lastError:
            error instanceof Error ? error.message.slice(0, 500) : "storage deletion failed",
          updatedAt: new Date(),
        })
        .where(eq(storageObjectDeletion.objectKey, item.objectKey));
    }
  }
  if (deleted.length)
    await database
      .delete(storageObjectDeletion)
      .where(inArray(storageObjectDeletion.objectKey, deleted));
  return { deleted: deleted.length, pending: pending.length - deleted.length };
};
