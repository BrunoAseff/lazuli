import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { Database } from "../database/client.ts";
import {
  createFlashcardCollection,
  deleteFlashcardCollection,
  listFlashcardCollections,
  updateFlashcardCollection,
} from "./flashcard-collection-queries.ts";

const userId = "user-1";
const collectionId = "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62";
const projectId = "8a9c628c-b222-42d9-a507-d8528f5015c0";
const now = new Date("2026-08-20T12:00:00.000Z");

type Builder = ReturnType<typeof createBuilder>;

const createBuilder = (result: unknown) => {
  const builder = Object.assign(Promise.resolve(result), {
    for: vi.fn(),
    from: vi.fn(),
    groupBy: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    onConflictDoNothing: vi.fn(),
    orderBy: vi.fn(),
    returning: vi.fn(),
    set: vi.fn(),
    values: vi.fn(),
    where: vi.fn(),
  });
  for (const method of [
    builder.for,
    builder.from,
    builder.groupBy,
    builder.innerJoin,
    builder.leftJoin,
    builder.limit,
    builder.offset,
    builder.onConflictDoNothing,
    builder.orderBy,
    builder.returning,
    builder.set,
    builder.values,
    builder.where,
  ])
    method.mockReturnValue(builder);
  return builder;
};

const createExecutor = ({
  deletes = [],
  inserts = [],
  selects = [],
  updates = [],
}: {
  deletes?: unknown[];
  inserts?: unknown[];
  selects?: unknown[];
  updates?: unknown[];
}) => {
  const builders: { insert: Builder[]; select: Builder[]; update: Builder[] } = {
    insert: [],
    select: [],
    update: [],
  };
  const take = (queue: unknown[], target: Builder[]) => {
    const builder = createBuilder(queue.shift() ?? []);
    target.push(builder);
    return builder;
  };
  const executor = {
    delete: vi.fn(() => createBuilder(deletes.shift() ?? [])),
    insert: vi.fn(() => take(inserts, builders.insert)),
    select: vi.fn(() => take(selects, builders.select)),
    update: vi.fn(() => take(updates, builders.update)),
  };
  return { builders, executor };
};

const collectionRow = (id = collectionId) => ({
  id,
  title: "Anatomia",
  projectId,
  projectTitle: "Medicina",
  archivedAt: null,
  createdAt: new Date("2026-08-19T12:00:00.000Z"),
  updatedAt: new Date("2026-08-19T12:00:00.000Z"),
});

describe("flashcard collection queries", () => {
  it("enriches an entire page with two aggregate queries instead of querying per collection", async () => {
    const secondId = "88282839-e512-4315-bae7-fdbbd547f5c0";
    const { builders, executor } = createExecutor({
      selects: [
        [{ value: 2 }],
        [collectionRow(), collectionRow(secondId)],
        [
          {
            collectionId,
            totalCards: 4,
            studiedCards: 3,
            dueCards: 2,
            nextPracticeAt: new Date("2026-08-21T12:00:00.000Z"),
            lastReviewedAt: new Date("2026-08-20T10:00:00.000Z"),
          },
        ],
        [{ collectionId, reviewsLastSevenDays: 5 }],
      ],
    });

    const result = await listFlashcardCollections(
      executor as unknown as Database,
      userId,
      { page: 1, pageSize: 12, project: "none", query: "100%_", status: "archived" },
      now,
    );

    expect(executor.select).toHaveBeenCalledTimes(4);
    const listWhere = new PgDialect().sqlToQuery(builders.select[0]!.where.mock.calls[0]![0]);
    expect(listWhere.sql).toContain('"flashcard_collection"."user_id" = $1');
    expect(listWhere.sql).toContain('"flashcard_collection"."archived_at" is not null');
    expect(listWhere.sql).toContain('"flashcard_collection"."project_id" is null');
    expect(listWhere.params).toContain(userId);
    expect(listWhere.params).toContain("%100\\%\\_%");
    expect(result.pagination).toEqual({ page: 1, pageSize: 12, totalItems: 2, totalPages: 1 });
    expect(result.items[0]).toMatchObject({
      id: collectionId,
      totalCards: 4,
      studiedCards: 3,
      dueCards: 2,
      reviewsLastSevenDays: 5,
    });
    expect(result.items[1]).toMatchObject({
      id: secondId,
      totalCards: 0,
      studiedCards: 0,
      dueCards: 0,
      reviewsLastSevenDays: 0,
    });
  });

  it("validates and creates a project association inside one transaction while holding a lock", async () => {
    const { builders, executor: tx } = createExecutor({
      inserts: [[{ id: collectionId }]],
      selects: [[{ id: projectId }], [collectionRow()], [], []],
    });
    const transaction = vi.fn((operation: (executor: unknown) => unknown) => operation(tx));
    const database = { transaction } as unknown as Database;

    const result = await createFlashcardCollection(database, userId, {
      id: collectionId,
      projectId,
      title: "Anatomia",
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(builders.select[0]?.for).toHaveBeenCalledWith("share");
    expect(tx.insert).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ kind: "ok", created: true });
  });

  it("does not write when the project is not owned", async () => {
    const { executor: tx } = createExecutor({ selects: [[]] });
    const transaction = vi.fn((operation: (executor: unknown) => unknown) => operation(tx));
    const database = { transaction } as unknown as Database;

    const result = await createFlashcardCollection(database, userId, {
      id: collectionId,
      projectId,
      title: "Anatomia",
    });

    expect(result).toEqual({ kind: "project-not-found" });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("keeps idempotent creation inside the transaction", async () => {
    const { executor: tx } = createExecutor({
      inserts: [[]],
      selects: [[{ ...collectionRow(), projectId: null, projectTitle: null }], [], []],
    });
    const transaction = vi.fn((operation: (executor: unknown) => unknown) => operation(tx));
    const database = { transaction } as unknown as Database;

    const result = await createFlashcardCollection(database, userId, {
      id: collectionId,
      projectId: null,
      title: "Anatomia",
    });

    expect(result).toMatchObject({ kind: "ok", created: false, collection: { id: collectionId } });
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("validates and updates a project association in the same transaction", async () => {
    const { builders, executor: tx } = createExecutor({
      selects: [[{ id: projectId }], [collectionRow()], [], []],
      updates: [[]],
    });
    const transaction = vi.fn((operation: (executor: unknown) => unknown) => operation(tx));
    const database = { transaction } as unknown as Database;

    const result = await updateFlashcardCollection(database, userId, collectionId, { projectId });

    expect(transaction).toHaveBeenCalledOnce();
    expect(builders.select[0]?.for).toHaveBeenCalledWith("share");
    expect(tx.update).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      kind: "ok",
      collection: { id: collectionId, project: { id: projectId } },
    });
  });

  it("conditions deletion on the owner and reports a missing collection", async () => {
    const deletedBuilder = createBuilder([]);
    const database = { delete: vi.fn(() => deletedBuilder) } as unknown as Database;

    const deleted = await deleteFlashcardCollection(database, userId, collectionId);
    const deletionWhere = new PgDialect().sqlToQuery(deletedBuilder.where.mock.calls[0]![0]);

    expect(deleted).toBe(false);
    expect(deletionWhere.sql).toContain('"flashcard_collection"."id" = $1');
    expect(deletionWhere.sql).toContain('"flashcard_collection"."user_id" = $2');
    expect(deletionWhere.params).toEqual([collectionId, userId]);
  });
});
