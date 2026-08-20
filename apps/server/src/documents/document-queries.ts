import type {
  CreateProjectItemInput,
  SaveDocumentContentInput,
  UpdateProjectItemInput,
} from "@lazuli/shared";
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";

import type { Database } from "../database/client.ts";
import { asset, document, project, projectItem } from "../database/schema/index.ts";

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
  deleteObjects: (objectKeys: string[]) => Promise<void>,
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
      .select({ objectKey: asset.objectKey })
      .from(asset)
      .where(
        and(
          eq(asset.userId, userId),
          eq(asset.projectId, projectId),
          inArray(asset.documentId, targets),
        ),
      );
    await deleteObjects(storedAssets.map(({ objectKey }) => objectKey));
    await tx
      .delete(projectItem)
      .where(and(eq(projectItem.id, itemId), eq(projectItem.projectId, projectId)));
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
    }

    if (isDeepStrictEqual(current.content, input.content))
      return {
        kind: "unchanged" as const,
        revision: current.revision,
        updatedAt: current.updatedAt,
      };

    const now = new Date();
    const [saved] = await tx
      .update(document)
      .set({ content: input.content, revision: sql`${document.revision} + 1`, updatedAt: now })
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
    await tx
      .update(projectItem)
      .set({ updatedAt: now })
      .where(and(eq(projectItem.id, documentId), eq(projectItem.projectId, projectId)));
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
  const [created] = await db.insert(asset).values(values).returning();
  return created;
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
  const [deleted] = await db
    .delete(asset)
    .where(and(eq(asset.id, assetId), eq(asset.userId, userId)))
    .returning();
  return deleted ?? null;
};
