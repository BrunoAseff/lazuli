import type {
  CreateProjectItemInput,
  SaveDocumentContentInput,
  UpdateProjectItemInput,
} from "@lazuli/shared";
import { STORAGE_BASIC_LIMIT_BYTES } from "@lazuli/shared";
import { and, asc, eq, inArray, isNull, lt, max, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";

import type { Database } from "../database/client.ts";
import {
  asset,
  document,
  project,
  projectItem,
  storageObjectDeletion,
  userStorage,
} from "../database/schema/index.ts";
import { enqueueObjectDeletions } from "../storage/storage-cleanup.ts";
import { reconcileDocumentReferences } from "../references/reference-queries.ts";

const ownedProject = (userId: string, projectId: string) =>
  and(eq(project.id, projectId), eq(project.userId, userId));

export const isValidProjectItemParent = (
  tree: Array<{ id: string; parentId: string | null; type: "folder" | "document" }>,
  itemId: string,
  parentId: string | null,
) => {
  if (parentId === null) return true;
  const byId = new Map(tree.map((item) => [item.id, item]));
  if (byId.get(parentId)?.type !== "folder") return false;
  let ancestorId: string | null = parentId;
  while (ancestorId) {
    if (ancestorId === itemId) return false;
    ancestorId = byId.get(ancestorId)?.parentId ?? null;
  }
  return true;
};

export const collectDescendantIds = (
  tree: Array<{ id: string; parentId: string | null }>,
  rootId: string,
) => {
  if (!tree.some((item) => item.id === rootId)) return null;
  const children = new Map<string, string[]>();
  for (const item of tree) {
    if (!item.parentId) continue;
    children.set(item.parentId, [...(children.get(item.parentId) ?? []), item.id]);
  }
  const ids = new Set<string>();
  const pending = [rootId];
  while (pending.length) {
    const id = pending.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    pending.push(...(children.get(id) ?? []));
  }
  return ids;
};

export const listProjectTree = async (db: Database, userId: string, projectId: string) => {
  const [owned] = await db
    .select({ id: project.id })
    .from(project)
    .where(ownedProject(userId, projectId))
    .limit(1);
  if (!owned) return null;
  return db
    .select()
    .from(projectItem)
    .where(eq(projectItem.projectId, projectId))
    .orderBy(asc(projectItem.position), asc(projectItem.id));
};

export const createProjectItem = async (
  db: Database,
  userId: string,
  projectId: string,
  input: CreateProjectItemInput,
) => {
  const [owned] = await db
    .select({ id: project.id })
    .from(project)
    .where(ownedProject(userId, projectId))
    .limit(1);
  if (!owned) return { kind: "not-found" as const };
  if (input.parentId) {
    const [parent] = await db
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

  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ value: max(projectItem.position) })
      .from(projectItem)
      .where(
        and(
          eq(projectItem.projectId, projectId),
          input.parentId
            ? eq(projectItem.parentId, input.parentId)
            : sql`${projectItem.parentId} IS NULL`,
        ),
      );
    const [inserted] = await tx
      .insert(projectItem)
      .values({ ...input, projectId, position: (last?.value ?? -1) + 1 })
      .onConflictDoNothing({ target: projectItem.id })
      .returning();
    if (inserted && input.type === "document") {
      await tx.insert(document).values({ id: input.id });
    }
    if (inserted) return { kind: "created" as const, item: inserted };

    const [existing] = await tx
      .select()
      .from(projectItem)
      .where(and(eq(projectItem.id, input.id), eq(projectItem.projectId, projectId)))
      .limit(1);
    const same =
      existing &&
      existing.type === input.type &&
      existing.title === input.title &&
      existing.parentId === input.parentId;
    return same ? { kind: "existing" as const, item: existing } : { kind: "conflict" as const };
  });
};

export const updateProjectItem = async (
  db: Database,
  userId: string,
  projectId: string,
  itemId: string,
  input: UpdateProjectItemInput,
) => {
  const [current] = await db
    .select({ item: projectItem })
    .from(projectItem)
    .innerJoin(project, eq(project.id, projectItem.projectId))
    .where(
      and(
        eq(projectItem.id, itemId),
        eq(projectItem.projectId, projectId),
        ownedProject(userId, projectId),
      ),
    )
    .limit(1);
  if (!current) return { kind: "not-found" as const };

  let tree: Awaited<ReturnType<typeof listProjectTree>> | undefined;
  if (input.parentId !== undefined) {
    tree = await listProjectTree(db, userId, projectId);
    if (!tree) return { kind: "not-found" as const };
    if (!isValidProjectItemParent(tree, itemId, input.parentId))
      return { kind: "invalid-parent" as const };
  }

  const titleChanged = input.title !== undefined && input.title !== current.item.title;
  const parentChanged = input.parentId !== undefined && input.parentId !== current.item.parentId;
  if (!titleChanged && !parentChanged) return { kind: "ok" as const, item: current.item };

  const values: Partial<typeof projectItem.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (titleChanged) values.title = input.title;
  if (parentChanged) {
    values.parentId = input.parentId;
    const siblings = tree!.filter((item) => item.parentId === input.parentId && item.id !== itemId);
    values.position = siblings.reduce((highest, item) => Math.max(highest, item.position), -1) + 1;
  }

  const [updated] = await db
    .update(projectItem)
    .set(values)
    .where(and(eq(projectItem.id, itemId), eq(projectItem.projectId, projectId)))
    .returning();
  return updated ? { kind: "ok" as const, item: updated } : { kind: "not-found" as const };
};

export const deleteProjectItem = async (
  db: Database,
  userId: string,
  projectId: string,
  itemId: string,
) => {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: project.id })
      .from(project)
      .where(ownedProject(userId, projectId))
      .limit(1)
      .for("update");
    if (!owned) return { kind: "project-not-found" as const };
    const tree = await tx
      .select()
      .from(projectItem)
      .where(eq(projectItem.projectId, projectId))
      .orderBy(asc(projectItem.position), asc(projectItem.id));
    const ids = collectDescendantIds(tree, itemId);
    if (!ids) return { kind: "item-not-found" as const };

    const targets = [...ids];
    const storedAssets = await tx
      .select({ objectKey: asset.objectKey, byteSize: asset.byteSize })
      .from(asset)
      .where(
        and(
          eq(asset.userId, userId),
          eq(asset.projectId, projectId),
          inArray(asset.documentId, targets),
        ),
      );
    const [documentBytes] = await tx
      .select({ value: sql<number>`coalesce(sum(${document.contentByteSize}), 0)::bigint` })
      .from(document)
      .where(inArray(document.id, targets));
    await enqueueObjectDeletions(
      tx,
      storedAssets.map(({ objectKey }) => objectKey),
    );
    await tx
      .delete(projectItem)
      .where(and(eq(projectItem.id, itemId), eq(projectItem.projectId, projectId)));
    const releasedBytes =
      storedAssets.reduce((sum, item) => sum + item.byteSize, 0) +
      Number(documentBytes?.value ?? 0);
    await tx
      .update(userStorage)
      .set({
        usedBytes: sql`greatest(0, ${userStorage.usedBytes} - ${releasedBytes})`,
        updatedAt: new Date(),
      })
      .where(eq(userStorage.userId, userId));
    return { kind: "deleted" as const };
  });
};

export const getDocument = async (
  db: Database,
  userId: string,
  projectId: string,
  documentId: string,
) => {
  const [result] = await db
    .select({
      item: projectItem,
      content: document.content,
      contentSchemaVersion: document.contentSchemaVersion,
      revision: document.revision,
    })
    .from(document)
    .innerJoin(projectItem, eq(projectItem.id, document.id))
    .innerJoin(project, eq(project.id, projectItem.projectId))
    .where(
      and(
        eq(document.id, documentId),
        eq(projectItem.projectId, projectId),
        ownedProject(userId, projectId),
      ),
    )
    .limit(1);
  return result ?? null;
};

export const saveDocumentContent = async (
  db: Database,
  userId: string,
  projectId: string,
  documentId: string,
  input: SaveDocumentContentInput,
) => {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        content: document.content,
        contentByteSize: document.contentByteSize,
        revision: document.revision,
        updatedAt: projectItem.updatedAt,
      })
      .from(document)
      .innerJoin(projectItem, eq(projectItem.id, document.id))
      .innerJoin(project, eq(project.id, projectItem.projectId))
      .where(
        and(
          eq(document.id, documentId),
          eq(projectItem.projectId, projectId),
          ownedProject(userId, projectId),
        ),
      )
      .limit(1);
    if (!current) return { kind: "not-found" as const };
    if (current.revision !== input.expectedRevision)
      return { kind: "conflict" as const, revision: current.revision };

    const referencedAssetIds = collectReferencedAssetIds(input.content);
    if (referencedAssetIds.length) {
      const ownedAssets = await tx
        .select({ id: asset.id })
        .from(asset)
        .where(
          and(
            eq(asset.userId, userId),
            eq(asset.projectId, projectId),
            eq(asset.documentId, documentId),
            inArray(asset.id, referencedAssetIds),
          ),
        );
      if (ownedAssets.length !== referencedAssetIds.length)
        return { kind: "invalid-assets" as const };
      await tx
        .update(asset)
        .set({ attachedAt: new Date() })
        .where(inArray(asset.id, referencedAssetIds));
    }

    if (isDeepStrictEqual(current.content, input.content))
      return {
        kind: "unchanged" as const,
        revision: current.revision,
        updatedAt: current.updatedAt,
      };

    const now = new Date();
    const contentByteSize = Buffer.byteLength(JSON.stringify(input.content));
    const storageDelta = contentByteSize - current.contentByteSize;
    await tx.insert(userStorage).values({ userId }).onConflictDoNothing();
    const [usage] = await tx
      .select()
      .from(userStorage)
      .where(eq(userStorage.userId, userId))
      .for("update");
    if (
      storageDelta > 0 &&
      (!usage || usage.usedBytes + usage.reservedBytes + storageDelta > STORAGE_BASIC_LIMIT_BYTES)
    )
      return { kind: "quota" as const };
    const [saved] = await tx
      .update(document)
      .set({
        content: input.content,
        contentByteSize,
        revision: sql`${document.revision} + 1`,
        updatedAt: now,
      })
      .where(and(eq(document.id, documentId), eq(document.revision, input.expectedRevision)))
      .returning({ revision: document.revision });
    if (!saved) {
      const [latest] = await tx
        .select({ revision: document.revision })
        .from(document)
        .where(eq(document.id, documentId))
        .limit(1);
      return { kind: "conflict" as const, revision: latest?.revision ?? current.revision };
    }
    await reconcileDocumentReferences(tx, userId, documentId, input.content);
    await tx
      .update(projectItem)
      .set({ updatedAt: now })
      .where(and(eq(projectItem.id, documentId), eq(projectItem.projectId, projectId)));
    await tx
      .update(userStorage)
      .set({
        usedBytes: sql`greatest(0, ${userStorage.usedBytes} + ${storageDelta})`,
        updatedAt: now,
      })
      .where(eq(userStorage.userId, userId));
    return { kind: "saved" as const, revision: saved.revision, updatedAt: now };
  });
};

const collectReferencedAssetIds = (content: SaveDocumentContentInput["content"]) => {
  const ids = new Set<string>();
  const pending = [...content];
  while (pending.length) {
    const block = pending.pop()!;
    if (block.type === "image") {
      const url = block.props?.url;
      if (typeof url === "string") {
        const match = /^\/api\/assets\/([0-9a-f-]{36})\/content$/i.exec(url);
        if (match?.[1]) ids.add(match[1]);
      }
    }
    if (block.children) pending.push(...block.children);
  }
  return [...ids];
};

export const createAsset = async (db: Database, values: typeof asset.$inferInsert) => {
  return db.transaction(async (tx) => {
    await tx.insert(userStorage).values({ userId: values.userId }).onConflictDoNothing();
    const [usage] = await tx
      .select()
      .from(userStorage)
      .where(eq(userStorage.userId, values.userId))
      .for("update");
    if (
      !usage ||
      usage.usedBytes + usage.reservedBytes + values.byteSize > STORAGE_BASIC_LIMIT_BYTES
    )
      return null;
    const [created] = await tx.insert(asset).values(values).returning();
    await tx
      .delete(storageObjectDeletion)
      .where(eq(storageObjectDeletion.objectKey, values.objectKey));
    await tx
      .update(userStorage)
      .set({ usedBytes: sql`${userStorage.usedBytes} + ${values.byteSize}`, updatedAt: new Date() })
      .where(eq(userStorage.userId, values.userId));
    return created!;
  });
};

export const getOwnedAsset = async (db: Database, userId: string, assetId: string) => {
  const [result] = await db
    .select()
    .from(asset)
    .where(and(eq(asset.id, assetId), eq(asset.userId, userId)))
    .limit(1);
  return result ?? null;
};

export const deleteOwnedAsset = async (db: Database, userId: string, assetId: string) => {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(asset)
      .where(and(eq(asset.id, assetId), eq(asset.userId, userId), isNull(asset.attachedAt)))
      .returning();
    if (!deleted) return null;
    await enqueueObjectDeletions(tx, [deleted.objectKey]);
    await tx
      .update(userStorage)
      .set({
        usedBytes: sql`greatest(0, ${userStorage.usedBytes} - ${deleted.byteSize})`,
        updatedAt: new Date(),
      })
      .where(eq(userStorage.userId, userId));
    return deleted;
  });
};

export const cleanupUnattachedAssets = async (db: Database) =>
  db.transaction(async (tx) => {
    const stale = await tx
      .select()
      .from(asset)
      .where(
        and(isNull(asset.attachedAt), lt(asset.createdAt, new Date(Date.now() - 24 * 60 * 60_000))),
      )
      .limit(50)
      .for("update", { skipLocked: true });
    if (!stale.length) return 0;
    await enqueueObjectDeletions(
      tx,
      stale.map((item) => item.objectKey),
    );
    await tx.delete(asset).where(
      inArray(
        asset.id,
        stale.map((item) => item.id),
      ),
    );
    const releasedByUser = new Map<string, number>();
    for (const item of stale)
      releasedByUser.set(item.userId, (releasedByUser.get(item.userId) ?? 0) + item.byteSize);
    for (const [userId, bytes] of releasedByUser)
      await tx
        .update(userStorage)
        .set({
          usedBytes: sql`greatest(0, ${userStorage.usedBytes} - ${bytes})`,
          updatedAt: new Date(),
        })
        .where(eq(userStorage.userId, userId));
    return stale.length;
  });
