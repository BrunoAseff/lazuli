import type { ObjectStorage } from "./object-storage.ts";

export class ObjectStorageCleanupError extends Error {
  constructor(public readonly failedCount: number) {
    super(`Failed to delete ${failedCount} object(s)`);
    this.name = "ObjectStorageCleanupError";
  }
}

export const deleteObjectBatch = async (storage: ObjectStorage, objectKeys: string[]) => {
  if (!objectKeys.length) return;
  const pending = [...objectKeys];
  let failedCount = 0;
  const workers = Array.from({ length: Math.min(8, pending.length) }, async () => {
    while (pending.length) {
      const key = pending.pop();
      if (!key) continue;
      try {
        await storage.delete(key);
      } catch {
        failedCount += 1;
      }
    }
  });
  await Promise.all(workers);
  if (failedCount) throw new ObjectStorageCleanupError(failedCount);
};
