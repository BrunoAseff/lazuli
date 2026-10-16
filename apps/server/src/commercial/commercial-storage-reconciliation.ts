import { DOCUMENT_IMPORT_ACTIVE_STATUSES } from "@lazuli/shared";
import { and, inArray, sql } from "drizzle-orm";

import type { Database, QueryExecutor } from "../database/client.ts";
import { asset, documentImport, userStorage } from "../database/schema/index.ts";

export type StorageDivergence = {
  userId: string;
  recordedUsedBytes: number;
  expectedUsedBytes: number;
  recordedReservedBytes: number;
  expectedReservedBytes: number;
};

const toUsageMap = <T extends { userId: string; value: number }>(rows: T[]) =>
  new Map(rows.map(({ userId, value }) => [userId, Number(value)]));

const readStorageState = async (database: QueryExecutor, userIds: string[]) => {
  const [assets, reservations, recorded] = await Promise.all([
    database
      .select({
        userId: asset.userId,
        value: sql<number>`coalesce(sum(${asset.byteSize}), 0)::bigint`,
      })
      .from(asset)
      .where(inArray(asset.userId, userIds))
      .groupBy(asset.userId),
    database
      .select({
        userId: documentImport.userId,
        value: sql<number>`coalesce(sum(${documentImport.inputByteSize}), 0)::bigint`,
      })
      .from(documentImport)
      .where(
        and(
          inArray(documentImport.userId, userIds),
          inArray(documentImport.status, DOCUMENT_IMPORT_ACTIVE_STATUSES),
        ),
      )
      .groupBy(documentImport.userId),
    database
      .select({
        userId: userStorage.userId,
        usedBytes: userStorage.usedBytes,
        reservedBytes: userStorage.reservedBytes,
      })
      .from(userStorage)
      .where(inArray(userStorage.userId, userIds)),
  ]);

  return findStorageDivergences(
    userIds,
    toUsageMap(assets),
    toUsageMap(reservations),
    new Map(recorded.map((usage) => [usage.userId, usage])),
  );
};

export const findStorageDivergences = (
  userIds: string[],
  assetBytes: ReadonlyMap<string, number>,
  reservedBytes: ReadonlyMap<string, number>,
  recordedByUser: ReadonlyMap<string, { usedBytes: number; reservedBytes: number }>,
) =>
  userIds.flatMap((userId) => {
    const usage = recordedByUser.get(userId);
    const expectedUsedBytes = assetBytes.get(userId) ?? 0;
    const expectedReservedBytes = reservedBytes.get(userId) ?? 0;
    const recordedUsedBytes = usage?.usedBytes ?? 0;
    const recordedReservedBytes = usage?.reservedBytes ?? 0;
    return recordedUsedBytes === expectedUsedBytes &&
      recordedReservedBytes === expectedReservedBytes
      ? []
      : [
          {
            userId,
            recordedUsedBytes,
            expectedUsedBytes,
            recordedReservedBytes,
            expectedReservedBytes,
          },
        ];
  });

export const reconcileStorageAccounts = async (
  database: Database,
  userIds: string[],
  options: { repair: boolean },
) => {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return [] satisfies StorageDivergence[];

  if (options.repair)
    return database.transaction(async (tx) => {
      await tx
        .insert(userStorage)
        .values(uniqueUserIds.map((userId) => ({ userId })))
        .onConflictDoNothing({ target: userStorage.userId });
      await tx
        .select({ userId: userStorage.userId })
        .from(userStorage)
        .where(inArray(userStorage.userId, uniqueUserIds))
        .for("update");

      const currentDivergences = await readStorageState(tx, uniqueUserIds);
      for (const divergence of currentDivergences)
        await tx
          .insert(userStorage)
          .values({
            userId: divergence.userId,
            usedBytes: divergence.expectedUsedBytes,
            reservedBytes: divergence.expectedReservedBytes,
          })
          .onConflictDoUpdate({
            target: userStorage.userId,
            set: {
              usedBytes: divergence.expectedUsedBytes,
              reservedBytes: divergence.expectedReservedBytes,
              updatedAt: new Date(),
            },
          });
      return currentDivergences;
    });

  return readStorageState(database, uniqueUserIds);
};
