import type {
  CreateStudyCollectionInput,
  FavoriteKind,
  UpdateStudyCollectionInput,
} from "@lazuli/shared";
import { and, count, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";

import type { Database, QueryExecutor } from "../database/client.ts";
import { pageOffset, paginationOf } from "../database/pagination.ts";
import { flashcardCollection, project, quizCollection } from "../database/schema/index.ts";
import { escapeLikePattern } from "../database/sql-search.ts";
import { isFavoriteSql } from "../favorites/favorite-queries.ts";
import { ownsProject } from "../projects/project-ownership.ts";

/** Both collection tables have the same columns; each kind passes its own. */
type CollectionTable = typeof flashcardCollection | typeof quizCollection;

export type StudyCollectionRow = {
  id: string;
  title: string;
  projectId: string | null;
  projectTitle: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListInput = {
  favorites?: "only" | "all";
  page: number;
  pageSize: number;
  project?: string;
  query: string;
  status: "active" | "archived";
};

/**
 * The collection queries flashcards and quizzes share: filtering, listing, one collection, create
 * (idempotent by id) and rename/move/archive. Each kind brings its table, its favorites kind and
 * how a page of rows gains its counts; deleting stays with each kind (its items differ).
 */
export const createStudyCollectionQueries = <
  Enriched extends { archivedAt: Date | null; project: { id: string } | null; title: string },
>({
  enrich,
  favoriteKind,
  table,
}: {
  enrich: (
    database: QueryExecutor,
    userId: string,
    rows: StudyCollectionRow[],
    now: Date,
  ) => Promise<Enriched[]>;
  favoriteKind: FavoriteKind;
  table: CollectionTable;
}) => {
  const selection = {
    id: table.id,
    title: table.title,
    projectId: project.id,
    projectTitle: project.title,
    archivedAt: table.archivedAt,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  };

  const whereFor = (userId: string, input: ListInput) =>
    and(
      eq(table.userId, userId),
      input.favorites === "only" ? isFavoriteSql(userId, favoriteKind, table.id) : undefined,
      input.status === "active" ? isNull(table.archivedAt) : isNotNull(table.archivedAt),
      input.project === "none"
        ? isNull(table.projectId)
        : input.project
          ? eq(table.projectId, input.project)
          : undefined,
      input.query
        ? sql<boolean>`unaccent(lower(${table.title})) LIKE unaccent(lower(${`%${escapeLikePattern(input.query)}%`})) ESCAPE ${"\\"}`
        : undefined,
    );

  const list = async (database: Database, userId: string, input: ListInput, now = new Date()) => {
    const where = whereFor(userId, input);
    const [total, rows] = await Promise.all([
      database.select({ value: count() }).from(table).where(where),
      database
        .select(selection)
        .from(table)
        .leftJoin(project, and(eq(project.id, table.projectId), eq(project.userId, userId)))
        .where(where)
        .orderBy(desc(table.createdAt), desc(table.id))
        .limit(input.pageSize)
        .offset(pageOffset(input)),
    ]);
    return {
      items: await enrich(database, userId, rows, now),
      pagination: paginationOf(input, total[0]?.value ?? 0),
    };
  };

  const get = async (
    database: QueryExecutor,
    userId: string,
    collectionId: string,
    now = new Date(),
  ) => {
    const [row] = await database
      .select(selection)
      .from(table)
      .leftJoin(project, and(eq(project.id, table.projectId), eq(project.userId, userId)))
      .where(and(eq(table.id, collectionId), eq(table.userId, userId)))
      .limit(1);
    if (!row) return null;
    return (await enrich(database, userId, [row], now))[0] ?? null;
  };

  const create = async (database: Database, userId: string, input: CreateStudyCollectionInput) =>
    database.transaction(async (tx) => {
      if (input.projectId && !(await ownsProject(tx, userId, input.projectId)))
        return { kind: "project-not-found" as const };
      const [inserted] = await tx
        .insert(table)
        .values({ ...input, userId })
        .onConflictDoNothing({ target: table.id })
        .returning({ id: table.id });
      if (inserted)
        return {
          kind: "ok" as const,
          created: true,
          collection: await get(tx, userId, inserted.id),
        };
      // A retried request with the same id: the same collection, or a conflict.
      const existing = await get(tx, userId, input.id);
      if (
        !existing ||
        existing.title !== input.title ||
        (existing.project?.id ?? null) !== input.projectId ||
        existing.archivedAt !== null
      )
        return { kind: "conflict" as const };
      return { kind: "ok" as const, created: false, collection: existing };
    });

  const update = async (
    database: Database,
    userId: string,
    collectionId: string,
    input: UpdateStudyCollectionInput,
  ) =>
    database.transaction(async (tx) => {
      if (input.projectId && !(await ownsProject(tx, userId, input.projectId)))
        return { kind: "project-not-found" as const };
      const changes = [];
      const values: {
        title?: string;
        projectId?: string | null;
        archivedAt?: Date | null;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (input.title !== undefined) {
        values.title = input.title;
        changes.push(sql`${table.title} is distinct from ${input.title}`);
      }
      if (input.projectId !== undefined) {
        values.projectId = input.projectId;
        changes.push(sql`${table.projectId} is distinct from ${input.projectId}`);
      }
      if (input.archived !== undefined) {
        values.archivedAt = input.archived ? new Date() : null;
        changes.push(input.archived ? isNull(table.archivedAt) : isNotNull(table.archivedAt));
      }
      // Only a real change touches the row, so updatedAt keeps meaning "last edited".
      await tx
        .update(table)
        .set(values)
        .where(and(eq(table.id, collectionId), eq(table.userId, userId), or(...changes)));
      const collection = await get(tx, userId, collectionId);
      return collection ? { kind: "ok" as const, collection } : { kind: "not-found" as const };
    });

  return { create, get, list, update };
};
