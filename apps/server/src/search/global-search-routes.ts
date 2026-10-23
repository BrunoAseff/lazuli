import {
  globalSearchRequestSchema,
  globalSearchResponseSchema,
  type GlobalSearchInput,
  type SearchKind,
} from "@lazuli/shared";
import { sql, type SQL } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createMutationAuthorizer, sendValidationError } from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";

export const buildSearchTerms = (query: string) =>
  (
    query
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  )
    .slice(0, 20)
    .map((term) => `${term.toLowerCase()}:*`)
    .join(" & ");

export const searchOwnedContent = async (
  database: Database,
  userId: string,
  input: GlobalSearchInput,
) => {
  const terms = buildSearchTerms(input.query);
  if (!terms) return { items: [], hasMore: false };
  const tsquery = sql`to_tsquery('simple', public.unaccent(${terms}))`;
  const favorite = (field: SQL) =>
    input.favorites
      ? sql`and exists (select 1 from user_favorite f where f.user_id=${userId} and ${field})`
      : sql``;
  const specifications: {
    kind: SearchKind;
    from: SQL;
    title: SQL;
    body: SQL;
    context: SQL;
    id: SQL;
    href: SQL;
    where: SQL;
  }[] = [
    {
      kind: "project",
      from: sql`project p`,
      title: sql`p.title`,
      body: sql`''::text`,
      context: sql`null::text`,
      id: sql`p.id`,
      href: sql`'/documents/' || p.id`,
      where: sql`p.user_id=${userId} ${favorite(sql`f.project_id=p.id`)}`,
    },
    {
      kind: "document",
      from: sql`project_item d join project p on p.id=d.project_id join document doc on doc.id=d.id`,
      title: sql`d.title`,
      body: sql`lazuli_content_text(doc.content)`,
      context: sql`p.title`,
      id: sql`d.id`,
      href: sql`'/documents/' || p.id || '/document/' || d.id`,
      where: sql`p.user_id=${userId} and d.type='document' ${favorite(sql`f.document_id=d.id`)}`,
    },
    {
      kind: "flashcards",
      from: sql`flashcard_collection c left join project p on p.id=c.project_id and p.user_id=c.user_id`,
      title: sql`c.title`,
      body: sql`''::text`,
      context: sql`p.title`,
      id: sql`c.id`,
      href: sql`'/flashcards/' || c.id`,
      where: sql`c.user_id=${userId} and c.archived_at is null ${favorite(sql`f.flashcard_collection_id=c.id`)}`,
    },
    {
      kind: "flashcard",
      from: sql`flashcard d join flashcard_collection c on c.id=d.collection_id`,
      title: sql`lazuli_content_text(d.question)`,
      body: sql`lazuli_content_text(d.answer)`,
      context: sql`c.title`,
      id: sql`d.id`,
      href: sql`'/flashcards/' || c.id || '?card=' || d.id`,
      where: sql`c.user_id=${userId} and c.archived_at is null and d.archived_at is null ${favorite(sql`f.flashcard_collection_id=c.id`)}`,
    },
    {
      kind: "quizzes",
      from: sql`quiz_collection c left join project p on p.id=c.project_id and p.user_id=c.user_id`,
      title: sql`c.title`,
      body: sql`''::text`,
      context: sql`p.title`,
      id: sql`c.id`,
      href: sql`'/quizzes/' || c.id`,
      where: sql`c.user_id=${userId} and c.archived_at is null ${favorite(sql`f.quiz_collection_id=c.id`)}`,
    },
    {
      kind: "question",
      from: sql`quiz_question d join quiz_collection c on c.id=d.collection_id`,
      title: sql`lazuli_content_text(d.content)`,
      body: sql`''::text`,
      context: sql`c.title`,
      id: sql`d.id`,
      href: sql`'/quizzes/' || c.id || '?question=' || d.id`,
      where: sql`c.user_id=${userId} and c.archived_at is null and d.archived_at is null ${favorite(sql`f.quiz_collection_id=c.id`)}`,
    },
  ];
  const limit = input.kind ? 21 : 5;
  const parts = specifications
    .filter((spec) => !input.kind || input.kind === spec.kind)
    .map(
      (spec) => sql`(
    select ${spec.kind}::text as kind, ${spec.id} as id, left(${spec.title}, 240) as title,
      ${spec.context} as context, ts_headline('lazuli_headline', ${spec.body}, ${tsquery}, 'StartSel=" ",StopSel=" ",MaxWords=24,MinWords=8,MaxFragments=1') as snippet,
      ${spec.href} as href,
      ts_rank_cd(lazuli_search_vector(${spec.title}), ${tsquery}) * 4 + ts_rank_cd(lazuli_search_vector(${spec.body}), ${tsquery}) as relevance
    from ${spec.from} where ${spec.where}
      and (lazuli_search_vector(${spec.title}) @@ ${tsquery} or lazuli_search_vector(${spec.body}) @@ ${tsquery})
    order by relevance desc, title, id limit ${limit} offset ${input.kind ? (input.page - 1) * 20 : 0}
  )`,
    );
  const rows = await database.execute(sql`${sql.join(parts, sql` union all `)}`);
  return globalSearchResponseSchema.parse({
    items: input.kind ? rows.slice(0, 20) : rows,
    hasMore: Boolean(input.kind && rows.length > 20),
  });
};

export const createGlobalSearchRoutes =
  ({
    auth,
    database,
    websiteUrl,
  }: {
    auth: Auth;
    database: Database;
    websiteUrl: string;
  }): FastifyPluginAsync =>
  async (app) => {
    const authorize = createMutationAuthorizer(
      auth,
      websiteUrl,
      createRequestRateLimiter({ limit: 180, windowMs: 60_000 }),
    );
    // POST keeps private search terms out of request URLs and standard access logs.
    app.post("/api/search", async (request, reply) => {
      const current = await authorize(request, reply);
      if (!current) return;
      const input = globalSearchRequestSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      return searchOwnedContent(database, current.user.id, input.data);
    });
  };
