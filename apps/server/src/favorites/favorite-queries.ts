import { type FavoriteKind, type FavoriteTarget } from "@lazuli/shared";
import { and, eq, sql, type SQLWrapper } from "drizzle-orm";
import type { Database, QueryExecutor } from "../database/client.ts";
import {
  userFavorite,
  project,
  projectItem,
  flashcardCollection,
  quizCollection,
} from "../database/schema/index.ts";

const columns = {
  project: userFavorite.projectId,
  document: userFavorite.documentId,
  flashcards: userFavorite.flashcardCollectionId,
  quizzes: userFavorite.quizCollectionId,
};
export const isFavoriteSql = (userId: string, kind: FavoriteKind, id: SQLWrapper) =>
  sql<boolean>`exists (select 1 from ${userFavorite} where ${userFavorite.userId} = ${userId} and ${columns[kind]} = ${id})`;

export const ownsFavoriteTarget = async (
  db: QueryExecutor,
  userId: string,
  target: FavoriteTarget,
) => {
  if (target.kind === "document") {
    const [owned] = await db
      .select({ id: projectItem.id })
      .from(projectItem)
      .innerJoin(project, eq(project.id, projectItem.projectId))
      .where(
        and(
          eq(projectItem.id, target.id),
          eq(projectItem.type, "document"),
          eq(project.userId, userId),
        ),
      )
      .limit(1);
    return Boolean(owned);
  }
  const table =
    target.kind === "project"
      ? project
      : target.kind === "flashcards"
        ? flashcardCollection
        : quizCollection;
  const [owned] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, target.id), eq(table.userId, userId)))
    .limit(1);
  return Boolean(owned);
};

export const setFavorite = (
  db: Database,
  userId: string,
  target: FavoriteTarget,
  enabled: boolean,
) =>
  db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`favorite:${userId}:${target.kind}:${target.id}`}))`,
    );
    if (!(await ownsFavoriteTarget(tx, userId, target))) return false;
    const column = columns[target.kind];
    if (!enabled)
      await tx
        .delete(userFavorite)
        .where(and(eq(userFavorite.userId, userId), eq(column, target.id)));
    else {
      const field = {
        project: "projectId",
        document: "documentId",
        flashcards: "flashcardCollectionId",
        quizzes: "quizCollectionId",
      }[target.kind];
      await tx
        .insert(userFavorite)
        .values({ id: crypto.randomUUID(), userId, [field]: target.id })
        .onConflictDoNothing();
    }
    return true;
  });

export const listFavorites = async (
  db: Database,
  userId: string,
  page = 1,
  kind?: FavoriteKind,
) => {
  const rows = await db.execute(sql`
    select kind, id, title, context, href from (
      select 'project' as kind, p.id, p.title, null::text as context, '/documents/' || p.id as href, f.created_at
      from user_favorite f join project p on p.id=f.project_id and p.user_id=${userId} where f.user_id=${userId}
      union all
      select 'document', d.id, d.title, p.title, '/documents/' || p.id || '/document/' || d.id, f.created_at
      from user_favorite f join project_item d on d.id=f.document_id and d.type='document' join project p on p.id=d.project_id and p.user_id=${userId} where f.user_id=${userId}
      union all
      select 'flashcards', c.id, c.title, p.title, '/flashcards/' || c.id, f.created_at
      from user_favorite f join flashcard_collection c on c.id=f.flashcard_collection_id and c.user_id=${userId} left join project p on p.id=c.project_id and p.user_id=c.user_id where f.user_id=${userId} and c.archived_at is null
      union all
      select 'quizzes', c.id, c.title, p.title, '/quizzes/' || c.id, f.created_at
      from user_favorite f join quiz_collection c on c.id=f.quiz_collection_id and c.user_id=${userId} left join project p on p.id=c.project_id and p.user_id=c.user_id where f.user_id=${userId} and c.archived_at is null
    ) favorites where (${kind ?? null}::text is null or kind=${kind ?? null}) order by created_at desc, kind, id limit 51 offset ${(page - 1) * 50}`);
  return { items: rows.slice(0, 50), hasMore: rows.length > 50 };
};
