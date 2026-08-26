import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../database/client.ts";
import {
  createQuizCollection,
  deleteQuizCollection,
  listQuizCollections,
} from "./quiz-collection-queries.ts";

const userId = "user-1";
const collectionId = "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62";
const projectId = "8a9c628c-b222-42d9-a507-d8528f5015c0";
const now = new Date("2026-08-25T12:00:00.000Z");

type Builder = ReturnType<typeof createBuilder>;

const createBuilder = (result: unknown) => {
  const builder = Object.assign(Promise.resolve(result), {
    for: vi.fn(),
    from: vi.fn(),
    groupBy: vi.fn(),
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
  for (const method of Object.values(builder).filter(
    (value): value is ReturnType<typeof vi.fn> => typeof value === "function",
  ))
    method.mockReturnValue(builder);
  return builder;
};

const createExecutor = (selects: unknown[] = [], deletes: unknown[] = []) => {
  const builders: Builder[] = [];
  const take = () => {
    const builder = createBuilder(selects.shift() ?? []);
    builders.push(builder);
    return builder;
  };
  return {
    builders,
    executor: {
      delete: vi.fn(() => createBuilder(deletes.shift() ?? [])),
      insert: vi.fn(() => createBuilder([])),
      select: vi.fn(take),
      selectDistinctOn: vi.fn(take),
      update: vi.fn(() => createBuilder([])),
    },
  };
};

const row = {
  id: collectionId,
  title: "História",
  projectId,
  projectTitle: "Humanidades",
  archivedAt: null,
  createdAt: new Date("2026-08-24T12:00:00.000Z"),
  updatedAt: new Date("2026-08-24T12:00:00.000Z"),
};

describe("quiz collection queries", () => {
  it("enriches a page with bounded aggregate queries and ignores incomplete attempts", async () => {
    const { builders, executor } = createExecutor([
      [{ value: 1 }],
      [row],
      [{ collectionId, totalQuestions: 6 }],
      [
        {
          collectionId,
          totalAttempts: 3,
          attemptsLastSevenDays: 2,
          bestScoreRate: 1,
        },
      ],
      [
        {
          collectionId,
          correctAnswers: 4,
          totalQuestions: 5,
          completedAt: new Date("2026-08-25T10:00:00.000Z"),
        },
      ],
    ]);

    const result = await listQuizCollections(
      executor as unknown as Database,
      userId,
      { page: 1, pageSize: 12, project: "none", query: "100%_", status: "archived" },
      now,
    );

    expect(executor.select).toHaveBeenCalledTimes(4);
    expect(executor.selectDistinctOn).toHaveBeenCalledOnce();
    const listWhere = new PgDialect().sqlToQuery(builders[0]!.where.mock.calls[0]![0]);
    expect(listWhere.sql).toContain('"quiz_collection"."user_id" = $1');
    expect(listWhere.params).toContain("%100\\%\\_%");
    expect(result.items[0]).toMatchObject({
      totalQuestions: 6,
      totalAttempts: 3,
      attemptsLastSevenDays: 2,
      lastScore: { correctAnswers: 4, totalQuestions: 5, rate: 0.8 },
      bestScoreRate: 1,
    });
  });

  it("does not create a collection for a project owned by another user", async () => {
    const { executor } = createExecutor([[]]);
    const transaction = vi.fn((operation: (tx: unknown) => unknown) => operation(executor));

    const result = await createQuizCollection({ transaction } as unknown as Database, userId, {
      id: collectionId,
      projectId,
      title: "História",
    });

    expect(result).toEqual({ kind: "project-not-found" });
    expect(executor.insert).not.toHaveBeenCalled();
  });

  it("conditions deletion on collection id and owner", async () => {
    const { executor } = createExecutor([], [[]]);
    const transaction = vi.fn((operation: (tx: unknown) => unknown) => operation(executor));

    const deleted = await deleteQuizCollection(
      { transaction } as unknown as Database,
      userId,
      collectionId,
    );
    const deletion = executor.delete.mock.results[0]!.value as Builder;
    const where = new PgDialect().sqlToQuery(deletion.where.mock.calls[0]![0]);

    expect(deleted).toBe(false);
    expect(where.sql).toContain('"quiz_collection"."id" = $1');
    expect(where.sql).toContain('"quiz_collection"."user_id" = $2');
    expect(where.params).toEqual([collectionId, userId]);
  });
});
