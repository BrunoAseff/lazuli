import { normalizeProjectItemTitle, STORAGE_BASIC_LIMIT_BYTES } from "@lazuli/shared";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { Worker } from "node:worker_threads";

import type { Database } from "../database/client.ts";
import { cleanupUnattachedAssets } from "../documents/document-queries.ts";
import {
  asset,
  document,
  documentImport,
  projectItem,
  storageObjectDeletion,
  userStorage,
} from "../database/schema/index.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import {
  enqueueObjectDeletions,
  processPendingObjectDeletions,
} from "../storage/storage-cleanup.ts";
import { ImportConversionError } from "./document-converters.ts";
import {
  claimNextImport,
  cancelAbandonedUploads,
  clearImportObjectKey,
  failDocumentImport,
  isImportCancellationRequested,
  listImportObjectsForCleanup,
  updateImportProgress,
  type ClaimedDocumentImport,
} from "./document-import-queries.ts";

const POLL_INTERVAL_MS = 1_000;
const CONVERSION_TIMEOUT_MS = 120_000;

const convertInThread = (
  mimeType: string,
  bytes: Uint8Array,
  onProgress: (current: number, total: number) => Promise<void>,
  isCanceled: () => Promise<boolean>,
) =>
  new Promise<{
    blocks: unknown[];
    warnings: string[];
    assets: Array<{ id: string; mimeType: string; bytes: Uint8Array }>;
  }>((resolve, reject) => {
    let progressChain = Promise.resolve();
    const worker = new Worker(new URL("./document-conversion-thread.ts", import.meta.url), {
      execArgv: process.execArgv,
      resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(cancellationTimer);
      void worker.terminate();
      callback();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new ImportConversionError("IMPORT_CONVERSION_TIMEOUT", "", false)));
    }, CONVERSION_TIMEOUT_MS);
    const cancellationTimer = setInterval(() => {
      void isCanceled()
        .then((canceled) => {
          if (canceled)
            finish(() => reject(new ImportConversionError("IMPORT_CANCELED", "", false)));
        })
        .catch(() => undefined);
    }, 750);
    worker.on(
      "message",
      (message: {
        type: string;
        current?: number;
        total?: number;
        result?: {
          blocks: unknown[];
          warnings: string[];
          assets: Array<{ id: string; mimeType: string; bytes: Uint8Array }>;
        };
        error?: { code: string; message?: string; retryable: boolean };
      }) => {
        if (message.type === "progress") {
          progressChain = progressChain.then(() => onProgress(message.current!, message.total!));
          void progressChain.catch((error) => {
            finish(() => reject(error));
          });
          return;
        }
        if (message.type === "result" && message.result)
          void progressChain
            .then(() => finish(() => resolve(message.result!)))
            .catch((error) => finish(() => reject(error)));
        else
          finish(() =>
            reject(
              new ImportConversionError(
                message.error?.code ?? "IMPORT_CONVERSION_FAILED",
                message.error?.message,
                message.error?.retryable ?? false,
              ),
            ),
          );
      },
    );
    worker.once("error", (error) => {
      finish(() => reject(error));
    });
    const transferable = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(transferable).set(bytes);
    worker.postMessage({ mimeType, bytes: new Uint8Array(transferable) }, [transferable]);
  });

const titleFromFilename = (filename: string) => {
  const withoutExtension = filename.replace(/\.(?:md|markdown|txt|docx|pdf)$/i, "").trim();
  return normalizeProjectItemTitle(withoutExtension || "Documento importado").slice(0, 100);
};

const completeImport = async (
  db: Database,
  job: ClaimedDocumentImport,
  workerId: string,
  content: unknown[],
  warnings: string[],
  importedAssets: Array<{ id: string; mimeType: string; byteSize: number; objectKey: string }>,
) => {
  const contentByteSize = Buffer.byteLength(JSON.stringify(content));
  const importedAssetBytes = importedAssets.reduce((sum, item) => sum + item.byteSize, 0);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(documentImport)
      .where(and(eq(documentImport.id, job.id), eq(documentImport.leaseOwner, workerId)))
      .limit(1)
      .for("update");
    if (!current) return false;
    const now = new Date();
    if (current.cancelRequestedAt) {
      await tx
        .update(documentImport)
        .set({ status: "canceled", finishedAt: now, leaseOwner: null, leasedUntil: null })
        .where(eq(documentImport.id, job.id));
      await tx
        .update(userStorage)
        .set({
          reservedBytes: sql`greatest(0, ${userStorage.reservedBytes} - ${job.inputByteSize})`,
          updatedAt: now,
        })
        .where(eq(userStorage.userId, job.userId));
      return false;
    }
    const [usage] = await tx
      .select()
      .from(userStorage)
      .where(eq(userStorage.userId, job.userId))
      .for("update");
    if (
      !usage ||
      usage.usedBytes +
        Math.max(0, usage.reservedBytes - job.inputByteSize) +
        contentByteSize +
        importedAssetBytes >
        STORAGE_BASIC_LIMIT_BYTES
    )
      throw new ImportConversionError("STORAGE_LIMIT_REACHED", "", false);
    let parentId = current.parentId;
    if (parentId) {
      const [parent] = await tx
        .select({ id: projectItem.id })
        .from(projectItem)
        .where(
          and(
            eq(projectItem.id, parentId),
            eq(projectItem.projectId, current.projectId),
            eq(projectItem.type, "folder"),
          ),
        )
        .limit(1);
      if (!parent) parentId = null;
    }
    const [last] = await tx
      .select({ value: max(projectItem.position) })
      .from(projectItem)
      .where(
        and(
          eq(projectItem.projectId, job.projectId),
          parentId ? eq(projectItem.parentId, parentId) : sql`${projectItem.parentId} IS NULL`,
        ),
      );
    await tx.insert(projectItem).values({
      id: job.documentId,
      projectId: job.projectId,
      parentId,
      type: "document",
      title: titleFromFilename(job.originalName),
      position: (last?.value ?? -1) + 1,
    });
    await tx.insert(document).values({
      id: job.documentId,
      content,
      contentByteSize,
    });
    if (importedAssets.length)
      await tx.insert(asset).values(
        importedAssets.map((item, index) => ({
          ...item,
          userId: job.userId,
          projectId: job.projectId,
          documentId: job.documentId,
          originalName: `imagem-importada-${index + 1}`,
          attachedAt: now,
        })),
      );
    if (importedAssets.length)
      await tx.delete(storageObjectDeletion).where(
        inArray(
          storageObjectDeletion.objectKey,
          importedAssets.map((item) => item.objectKey),
        ),
      );
    await tx
      .update(userStorage)
      .set({
        usedBytes: sql`${userStorage.usedBytes} + ${contentByteSize + importedAssetBytes}`,
        reservedBytes: sql`greatest(0, ${userStorage.reservedBytes} - ${job.inputByteSize})`,
        updatedAt: now,
      })
      .where(eq(userStorage.userId, job.userId));
    await tx
      .update(documentImport)
      .set({
        status: "completed",
        phase: "finalizing",
        warnings,
        resultDocumentId: job.documentId,
        progressCurrent: 1,
        progressTotal: 1,
        leaseOwner: null,
        leasedUntil: null,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(documentImport.id, job.id));
    return true;
  });
};

const processImport = async (
  db: Database,
  storage: ObjectStorage,
  job: ClaimedDocumentImport,
  workerId: string,
) => {
  if (!job.inputObjectKey || !job.detectedMimeType)
    throw new ImportConversionError("UPLOAD_NOT_AVAILABLE", "", false);
  const object = await storage.get(job.inputObjectKey);
  if (!object.Body) throw new ImportConversionError("UPLOAD_NOT_AVAILABLE", "", true);
  const bytes = await object.Body.transformToByteArray();
  let progressCurrent: number | null = null;
  let progressTotal: number | null = null;
  let phase: "extracting" | "converting" = "extracting";
  const heartbeat = setInterval(() => {
    void updateImportProgress(db, job.id, workerId, phase, progressCurrent, progressTotal).catch(
      () => undefined,
    );
  }, 30_000);
  let result: Awaited<ReturnType<typeof convertInThread>>;
  try {
    result = await convertInThread(
      job.detectedMimeType,
      bytes,
      async (current, total) => {
        if (await isImportCancellationRequested(db, job.id, workerId))
          throw new ImportConversionError("IMPORT_CANCELED", "", false);
        phase = "converting";
        progressCurrent = current;
        progressTotal = total;
        await updateImportProgress(db, job.id, workerId, phase, current, total);
      },
      () => isImportCancellationRequested(db, job.id, workerId),
    );
  } finally {
    clearInterval(heartbeat);
  }
  const importedAssets: Array<{
    id: string;
    mimeType: string;
    byteSize: number;
    objectKey: string;
  }> = [];
  try {
    for (const item of result.assets) {
      if (await isImportCancellationRequested(db, job.id, workerId))
        throw new ImportConversionError("IMPORT_CANCELED", "", false);
      const extension = item.mimeType === "image/jpeg" ? "jpg" : item.mimeType.split("/")[1]!;
      const objectKey = `${job.userId}/${job.projectId}/${job.documentId}/${item.id}.${extension}`;
      await enqueueObjectDeletions(db, [objectKey], 10 * 60_000);
      await storage.put(objectKey, item.bytes, item.mimeType);
      importedAssets.push({
        id: item.id,
        mimeType: item.mimeType,
        byteSize: item.bytes.byteLength,
        objectKey,
      });
    }
  } catch (error) {
    await enqueueObjectDeletions(
      db,
      importedAssets.map((item) => item.objectKey),
    );
    throw error;
  }
  await updateImportProgress(db, job.id, workerId, "finalizing", 0, 1);
  try {
    const completed = await completeImport(
      db,
      job,
      workerId,
      result.blocks,
      result.warnings,
      importedAssets,
    );
    if (!completed)
      await enqueueObjectDeletions(
        db,
        importedAssets.map((item) => item.objectKey),
      );
  } catch (error) {
    await enqueueObjectDeletions(
      db,
      importedAssets.map((item) => item.objectKey),
    );
    throw error;
  }
  try {
    await storage.delete(job.inputObjectKey);
    await clearImportObjectKey(db, job.id, job.inputObjectKey);
  } catch {
    // A manutenção periódica usa a chave persistida para tentar novamente.
  }
};

export const createDocumentImportWorker = (
  db: Database,
  storage: ObjectStorage,
  logger: FastifyBaseLogger,
) => {
  const workerId = `document-import:${process.pid}:${crypto.randomUUID()}`;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let running = false;
  let inFlight: Promise<void> | undefined;
  let lastMaintenanceAt = 0;

  const launch = () => {
    if (stopped || inFlight) return;
    const operation = run();
    inFlight = operation;
    void operation.finally(() => {
      if (inFlight === operation) inFlight = undefined;
    });
  };
  const schedule = () => {
    if (!stopped) timer = setTimeout(launch, POLL_INTERVAL_MS);
  };
  const run = async () => {
    if (stopped || running) return schedule();
    running = true;
    try {
      if (Date.now() - lastMaintenanceAt > 60_000) {
        await cancelAbandonedUploads(db);
        await cleanupUnattachedAssets(db);
        await processPendingObjectDeletions(db, storage);
        const expiredObjects = await listImportObjectsForCleanup(db);
        for (const item of expiredObjects) {
          if (!item.objectKey) continue;
          try {
            await storage.delete(item.objectKey);
            await clearImportObjectKey(db, item.id, item.objectKey);
          } catch {
            logger.warn({ importId: item.id }, "document import object cleanup deferred");
          }
        }
        lastMaintenanceAt = Date.now();
      }
      const job = await claimNextImport(db, workerId);
      if (job) {
        try {
          await processImport(db, storage, job, workerId);
        } catch (error) {
          logger.error({ err: error, importId: job.id }, "document import processing failed");
          const known = error instanceof ImportConversionError;
          const failed = await failDocumentImport(
            db,
            job.id,
            workerId,
            known ? error.code : "IMPORT_PROCESSING_FAILED",
            known ? error.retryable : true,
          );
          if (failed?.status === "canceled" && job.inputObjectKey) {
            try {
              await storage.delete(job.inputObjectKey);
              await db
                .update(documentImport)
                .set({ inputObjectKey: null, updatedAt: new Date() })
                .where(eq(documentImport.id, job.id));
            } catch {
              logger.warn({ importId: job.id }, "canceled import object cleanup deferred");
            }
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, "document import worker iteration failed");
    } finally {
      running = false;
      schedule();
    }
  };

  return {
    start() {
      launch();
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inFlight;
    },
  };
};
