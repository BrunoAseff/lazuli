import {
  DOCUMENT_IMPORT_ACTIVE_STATUSES,
  DOCUMENT_IMPORT_MAX_ACTIVE,
  DOCUMENT_IMPORT_RATE_LIMIT,
  DOCUMENT_IMPORT_RATE_WINDOW_MS,
  STORAGE_BASIC_LIMIT_BYTES,
  type CreateDocumentImportInput,
} from "@lazuli/shared";
import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { documentImport, project, projectItem, userStorage } from "../database/schema/index.ts";

export const createDocumentImport = async (
  db: Database,
  userId: string,
  projectId: string,
  input: CreateDocumentImportInput,
) =>
  db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.userId, userId)))
      .limit(1);
    if (!owned) return { kind: "not-found" as const };

    if (input.parentId) {
      const [parent] = await tx
        .select({ id: projectItem.id })
        .from(projectItem)
        .where(
          and(
            eq(projectItem.id, input.parentId),
            eq(projectItem.projectId, projectId),
            eq(projectItem.type, "folder"),
          ),
        )
        .limit(1);
      if (!parent) return { kind: "invalid-parent" as const };
    }

    const [existing] = await tx
      .select()
      .from(documentImport)
      .where(and(eq(documentImport.id, input.id), eq(documentImport.userId, userId)))
      .limit(1);
    if (existing) {
      const same =
        existing.projectId === projectId &&
        existing.documentId === input.documentId &&
        existing.parentId === input.parentId &&
        existing.originalName === input.originalName &&
        existing.declaredMimeType === input.mimeType &&
        existing.inputByteSize === input.byteSize;
      return same ? { kind: "existing" as const, item: existing } : { kind: "conflict" as const };
    }

    await tx.insert(userStorage).values({ userId }).onConflictDoNothing();
    const [usage] = await tx
      .select()
      .from(userStorage)
      .where(eq(userStorage.userId, userId))
      .for("update");
    const [recent] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(documentImport)
      .where(
        and(
          eq(documentImport.userId, userId),
          gte(documentImport.createdAt, new Date(Date.now() - DOCUMENT_IMPORT_RATE_WINDOW_MS)),
        ),
      );
    if ((recent?.count ?? 0) >= DOCUMENT_IMPORT_RATE_LIMIT)
      return { kind: "rate-limited" as const };
    const [active] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(documentImport)
      .where(
        and(
          eq(documentImport.userId, userId),
          inArray(documentImport.status, [...DOCUMENT_IMPORT_ACTIVE_STATUSES]),
        ),
      );
    if ((active?.count ?? 0) >= DOCUMENT_IMPORT_MAX_ACTIVE) return { kind: "too-many" as const };
    if (
      !usage ||
      usage.usedBytes + usage.reservedBytes + input.byteSize > STORAGE_BASIC_LIMIT_BYTES
    )
      return { kind: "quota" as const };

    const [created] = await tx
      .insert(documentImport)
      .values({
        id: input.id,
        userId,
        projectId,
        parentId: input.parentId,
        documentId: input.documentId,
        originalName: input.originalName,
        declaredMimeType: input.mimeType,
        inputByteSize: input.byteSize,
      })
      .returning();
    await tx
      .update(userStorage)
      .set({
        reservedBytes: sql`${userStorage.reservedBytes} + ${input.byteSize}`,
        updatedAt: new Date(),
      })
      .where(eq(userStorage.userId, userId));
    return { kind: "created" as const, item: created! };
  });

export const getOwnedDocumentImport = async (db: Database, userId: string, importId: string) => {
  const [item] = await db
    .select()
    .from(documentImport)
    .where(and(eq(documentImport.id, importId), eq(documentImport.userId, userId)))
    .limit(1);
  return item ?? null;
};

export const listDocumentImports = (db: Database, userId: string) =>
  db
    .select()
    .from(documentImport)
    .where(
      and(
        eq(documentImport.userId, userId),
        or(
          inArray(documentImport.status, [...DOCUMENT_IMPORT_ACTIVE_STATUSES]),
          gte(documentImport.finishedAt, new Date(Date.now() - 2 * 60 * 60 * 1_000)),
        ),
      ),
    )
    .orderBy(
      sql`case when ${inArray(documentImport.status, [...DOCUMENT_IMPORT_ACTIVE_STATUSES])} then 0 else 1 end`,
      desc(documentImport.createdAt),
    )
    .limit(50);

export const getStorageUsage = async (db: Database, userId: string) => {
  await db.insert(userStorage).values({ userId }).onConflictDoNothing();
  const [usage] = await db
    .select({ usedBytes: userStorage.usedBytes, reservedBytes: userStorage.reservedBytes })
    .from(userStorage)
    .where(eq(userStorage.userId, userId));
  return { ...usage!, limitBytes: STORAGE_BASIC_LIMIT_BYTES };
};

export const markImportQueued = async (
  db: Database,
  userId: string,
  importId: string,
  objectKey: string,
  detectedMimeType: string,
) => {
  const [updated] = await db
    .update(documentImport)
    .set({
      inputObjectKey: objectKey,
      detectedMimeType,
      status: "queued",
      phase: "validating",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentImport.id, importId),
        eq(documentImport.userId, userId),
        eq(documentImport.status, "uploading"),
        isNull(documentImport.inputObjectKey),
      ),
    )
    .returning();
  return updated ?? null;
};

const releaseReservation = async (
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  userId: string,
  bytes: number,
) => {
  await tx
    .update(userStorage)
    .set({
      reservedBytes: sql`greatest(0, ${userStorage.reservedBytes} - ${bytes})`,
      updatedAt: new Date(),
    })
    .where(eq(userStorage.userId, userId));
};

export const cancelDocumentImport = async (db: Database, userId: string, importId: string) =>
  db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(documentImport)
      .where(and(eq(documentImport.id, importId), eq(documentImport.userId, userId)))
      .limit(1)
      .for("update");
    if (!current) return null;
    if (["completed", "failed", "canceled"].includes(current.status)) return current;
    const now = new Date();
    if (current.status === "uploading" || current.status === "queued") {
      const [canceled] = await tx
        .update(documentImport)
        .set({ status: "canceled", finishedAt: now, updatedAt: now })
        .where(eq(documentImport.id, importId))
        .returning();
      await releaseReservation(tx, userId, current.inputByteSize);
      return canceled!;
    }
    const [requested] = await tx
      .update(documentImport)
      .set({ cancelRequestedAt: now, updatedAt: now })
      .where(eq(documentImport.id, importId))
      .returning();
    return requested!;
  });

export const retryDocumentImport = async (db: Database, userId: string, importId: string) =>
  db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(documentImport)
      .where(and(eq(documentImport.id, importId), eq(documentImport.userId, userId)))
      .limit(1)
      .for("update");
    if (!current || current.status !== "failed" || !current.inputObjectKey) return null;
    await tx.insert(userStorage).values({ userId }).onConflictDoNothing();
    const [usage] = await tx
      .select()
      .from(userStorage)
      .where(eq(userStorage.userId, userId))
      .for("update");
    if (
      !usage ||
      usage.usedBytes + usage.reservedBytes + current.inputByteSize > STORAGE_BASIC_LIMIT_BYTES
    )
      return { kind: "quota" as const };
    const now = new Date();
    const [updated] = await tx
      .update(documentImport)
      .set({
        status: "queued",
        phase: "validating",
        progressCurrent: null,
        progressTotal: null,
        errorCode: null,
        finishedAt: null,
        availableAt: now,
        updatedAt: now,
      })
      .where(eq(documentImport.id, importId))
      .returning();
    await tx
      .update(userStorage)
      .set({ reservedBytes: sql`${userStorage.reservedBytes} + ${current.inputByteSize}` })
      .where(eq(userStorage.userId, userId));
    return { kind: "queued" as const, item: updated! };
  });

export const claimNextImport = async (db: Database, workerId: string) =>
  db.transaction(async (tx) => {
    const now = new Date();
    const [next] = await tx
      .select()
      .from(documentImport)
      .where(
        or(
          and(eq(documentImport.status, "queued"), lt(documentImport.availableAt, now)),
          and(
            or(eq(documentImport.status, "processing"), eq(documentImport.status, "finalizing")),
            lt(documentImport.leasedUntil, now),
          ),
        ),
      )
      .orderBy(asc(documentImport.availableAt), asc(documentImport.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!next) return null;
    const [claimed] = await tx
      .update(documentImport)
      .set({
        status: "processing",
        phase: "extracting",
        attempts: sql`${documentImport.attempts} + 1`,
        leaseOwner: workerId,
        leasedUntil: new Date(now.getTime() + 120_000),
        startedAt: next.startedAt ?? now,
        updatedAt: now,
      })
      .where(eq(documentImport.id, next.id))
      .returning();
    return claimed ?? null;
  });

export const updateImportProgress = (
  db: Database,
  importId: string,
  workerId: string,
  phase: "extracting" | "converting" | "finalizing",
  current: number | null,
  total: number | null,
) =>
  db
    .update(documentImport)
    .set({
      status: phase === "finalizing" ? "finalizing" : "processing",
      phase,
      progressCurrent: current,
      progressTotal: total,
      leasedUntil: new Date(Date.now() + 120_000),
      updatedAt: new Date(),
    })
    .where(and(eq(documentImport.id, importId), eq(documentImport.leaseOwner, workerId)));

export const isImportCancellationRequested = async (
  db: Database,
  importId: string,
  workerId: string,
) => {
  const [item] = await db
    .select({ cancelRequestedAt: documentImport.cancelRequestedAt })
    .from(documentImport)
    .where(and(eq(documentImport.id, importId), eq(documentImport.leaseOwner, workerId)))
    .limit(1);
  return !item || Boolean(item.cancelRequestedAt);
};

export const cancelAbandonedUploads = async (db: Database) =>
  db.transaction(async (tx) => {
    const cutoff = new Date(Date.now() - 60 * 60 * 1_000);
    const abandoned = await tx
      .select()
      .from(documentImport)
      .where(and(eq(documentImport.status, "uploading"), lt(documentImport.createdAt, cutoff)))
      .limit(50)
      .for("update", { skipLocked: true });
    const now = new Date();
    for (const item of abandoned) {
      await tx
        .update(documentImport)
        .set({ status: "canceled", errorCode: "UPLOAD_EXPIRED", finishedAt: now, updatedAt: now })
        .where(eq(documentImport.id, item.id));
      await releaseReservation(tx, item.userId, item.inputByteSize);
    }
    return abandoned.length;
  });

export const listImportObjectsForCleanup = (db: Database) =>
  db
    .select({ id: documentImport.id, objectKey: documentImport.inputObjectKey })
    .from(documentImport)
    .where(
      and(
        or(
          and(
            eq(documentImport.status, "failed"),
            lt(documentImport.finishedAt, new Date(Date.now() - 24 * 60 * 60 * 1_000)),
          ),
          and(
            or(eq(documentImport.status, "completed"), eq(documentImport.status, "canceled")),
            lt(documentImport.finishedAt, new Date(Date.now() - 5 * 60 * 1_000)),
          ),
        ),
        sql`${documentImport.inputObjectKey} IS NOT NULL`,
      ),
    )
    .limit(50);

export const clearImportObjectKey = (db: Database, importId: string, objectKey: string) =>
  db
    .update(documentImport)
    .set({ inputObjectKey: null, updatedAt: new Date() })
    .where(and(eq(documentImport.id, importId), eq(documentImport.inputObjectKey, objectKey)));

export const failDocumentImport = async (
  db: Database,
  importId: string,
  workerId: string,
  errorCode: string,
  retryable: boolean,
) =>
  db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(documentImport)
      .where(and(eq(documentImport.id, importId), eq(documentImport.leaseOwner, workerId)))
      .limit(1)
      .for("update");
    if (!current) return null;
    const retry = retryable && current.attempts < current.maxAttempts && !current.cancelRequestedAt;
    const now = new Date();
    const [updated] = await tx
      .update(documentImport)
      .set(
        retry
          ? {
              status: "queued",
              phase: "validating",
              progressCurrent: null,
              progressTotal: null,
              availableAt: new Date(now.getTime() + 2 ** current.attempts * 1_000),
              leaseOwner: null,
              leasedUntil: null,
              errorCode,
              updatedAt: now,
            }
          : {
              status: current.cancelRequestedAt ? "canceled" : "failed",
              leaseOwner: null,
              leasedUntil: null,
              errorCode,
              finishedAt: now,
              updatedAt: now,
            },
      )
      .where(eq(documentImport.id, importId))
      .returning();
    if (!retry) await releaseReservation(tx, current.userId, current.inputByteSize);
    return updated ?? null;
  });

export type ClaimedDocumentImport = NonNullable<Awaited<ReturnType<typeof claimNextImport>>>;
