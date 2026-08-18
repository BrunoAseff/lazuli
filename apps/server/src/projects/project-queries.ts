import type { CreateProjectInput, ProjectListQuery, UpdateProjectInput } from "@lazuli/shared";
import { and, count, desc, eq, or, sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { document, project } from "../database/schema/index.ts";

export const escapeLikePattern = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

const createSearchCondition = (query: string) => {
  if (!query) {
    return undefined;
  }

  const pattern = `%${escapeLikePattern(query)}%`;
  return sql<boolean>`unaccent(lower(${project.title})) LIKE unaccent(lower(${pattern})) ESCAPE ${"\\"}`;
};

const projectSelection = {
  id: project.id,
  title: project.title,
  coverKey: project.coverKey,
  documentCount: count(document.id).mapWith(Number),
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
};

export const listProjects = async (database: Database, userId: string, input: ProjectListQuery) => {
  const where = and(eq(project.userId, userId), createSearchCondition(input.query));
  const [total] = await database.select({ value: count() }).from(project).where(where);
  const totalItems = total?.value ?? 0;

  const items = await database
    .select(projectSelection)
    .from(project)
    .leftJoin(document, eq(document.projectId, project.id))
    .where(where)
    .groupBy(project.id)
    .orderBy(desc(project.updatedAt), desc(project.id))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return {
    items,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
    },
  };
};

export const getProject = async (database: Database, userId: string, projectId: string) => {
  const [result] = await database
    .select(projectSelection)
    .from(project)
    .leftJoin(document, eq(document.projectId, project.id))
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .groupBy(project.id)
    .limit(1);

  return result ?? null;
};

export const createProject = async (
  database: Database,
  userId: string,
  input: CreateProjectInput,
) => {
  const [inserted] = await database
    .insert(project)
    .values({ ...input, userId })
    .onConflictDoNothing({ target: project.id })
    .returning({ id: project.id });

  if (inserted) {
    return { created: true, project: await getProject(database, userId, inserted.id) };
  }

  const existing = await getProject(database, userId, input.id);
  const isSameOperation = existing?.title === input.title && existing.coverKey === input.coverKey;

  return isSameOperation ? { created: false, project: existing } : null;
};

export const updateProject = async (
  database: Database,
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
) => {
  const changedConditions = [];
  const values: {
    title?: string;
    coverKey?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.title !== undefined) {
    values.title = input.title;
    changedConditions.push(sql`${project.title} IS DISTINCT FROM ${input.title}`);
  }
  if (input.coverKey !== undefined) {
    values.coverKey = input.coverKey;
    changedConditions.push(sql`${project.coverKey} IS DISTINCT FROM ${input.coverKey}`);
  }

  const [updated] = await database
    .update(project)
    .set(values)
    .where(and(eq(project.id, projectId), eq(project.userId, userId), or(...changedConditions)))
    .returning({ id: project.id });

  return getProject(database, userId, updated?.id ?? projectId);
};

export const deleteProject = async (database: Database, userId: string, projectId: string) => {
  const [deleted] = await database
    .delete(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .returning({ id: project.id });

  return Boolean(deleted);
};

export const listProjectDocuments = async (
  database: Database,
  userId: string,
  projectId: string,
  input: ProjectListQuery,
) => {
  const [ownedProject] = await database
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);

  if (!ownedProject) {
    return null;
  }

  const where = and(
    eq(document.projectId, projectId),
    input.query
      ? sql<boolean>`unaccent(lower(${document.title})) LIKE unaccent(lower(${`%${escapeLikePattern(input.query)}%`})) ESCAPE ${"\\"}`
      : undefined,
  );
  const [total] = await database.select({ value: count() }).from(document).where(where);
  const totalItems = total?.value ?? 0;
  const items = await database
    .select({
      id: document.id,
      title: document.title,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    })
    .from(document)
    .where(where)
    .orderBy(desc(document.updatedAt), desc(document.id))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return {
    items,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
    },
  };
};
