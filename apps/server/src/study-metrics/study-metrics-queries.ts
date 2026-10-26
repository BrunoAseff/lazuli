import { sql } from "drizzle-orm";
import {
  studyMetricsResponseSchema,
  studyMetricsRankingSchema,
  studyMetricsAttemptsSchema,
  studyMetricsCollectionsSchema,
  STUDY_METRICS_MIN_RANK,
  type StudyMetricsQuery,
  type StudyMetricsView,
  type StudyMetricsPoint,
} from "@lazuli/shared";
import type { QueryExecutor } from "../database/client.ts";
import { groupMetricsDays, alignPreviousDays, comparisonWindow } from "./metrics-calendar.ts";

const collectionFilter = (id?: string) => (id ? sql`and c.id=${id}` : sql``);
const bounds = (input: StudyMetricsQuery, cutoff?: string) => sql`bounds as (
  select (${input.from}::date::timestamp at time zone ${input.tz}) as start_at,
  least(((${input.to}::date+1)::timestamp at time zone ${input.tz}), coalesce(${cutoff ?? null}::timestamptz,now())) as end_at
)`;

const flashcardRows = (
  userId: string,
  input: StudyMetricsQuery,
  disabled = false,
  details = false,
) => sql`f as (
  select r.*, c.id as collection_id, c.title as collection_title,
    (c.archived_at is not null or d.archived_at is not null) as archived,
    d.archived_at is not null as material_archived,
    ${details ? sql`lazuli_content_text(d.question)` : sql`''::text`} as title,
    to_char(r.reviewed_at at time zone ${input.tz}, 'YYYY-MM-DD') as day
  from flashcard_review r
  join flashcard_practice_session s on s.id=r.session_id and s.user_id=${userId}
  join flashcard d on d.id=r.flashcard_id
  join flashcard_collection c on c.id=d.collection_id and c.user_id=${userId}
  cross join bounds b
  where r.reviewed_at >= b.start_at and r.reviewed_at < b.end_at
    ${collectionFilter(input.collectionId)} ${disabled ? sql`and false` : sql``}
), eligible as (
  select distinct on (flashcard_id, day) * from f
  where previous_state='review' and elapsed_days>=1
  order by flashcard_id, day, reviewed_at, id
)`;

const quizRows = (
  userId: string,
  input: StudyMetricsQuery,
  disabled = false,
  details = false,
) => sql`q as (
  select i.id,i.attempt_id,i.is_correct,${details ? sql`i.question_id,i.original_question_id,i.question_fingerprint,i.question,` : sql``}
    a.completed_at, a.collection_id, c.title as collection_title,
    c.archived_at is not null as collection_archived,
    to_char(a.completed_at at time zone ${input.tz}, 'YYYY-MM-DD') as day
  from quiz_attempt a
  join quiz_collection c on c.id=a.collection_id and c.user_id=${userId}
  join quiz_attempt_item i on i.attempt_id=a.id
  cross join bounds b
  where a.user_id=${userId} and a.status='completed'
    and a.completed_at >= b.start_at and a.completed_at < b.end_at
    ${collectionFilter(input.collectionId)} ${disabled ? sql`and false` : sql``}
)`;

export const ownsMetricsCollection = async (
  db: QueryExecutor,
  userId: string,
  view: StudyMetricsView,
  id: string,
) => {
  if (view === "overview") return false;
  const table = view === "flashcards" ? sql`flashcard_collection` : sql`quiz_collection`;
  return (
    (await db.execute(sql`select id from ${table} where id=${id} and user_id=${userId} limit 1`))
      .length > 0
  );
};

export function metricsAggregateQuery(
  userId: string,
  input: StudyMetricsQuery,
  view: StudyMetricsView,
  cutoff?: string,
) {
  return sql`with ${bounds(input, cutoff)}, ${flashcardRows(userId, input, view === "quizzes")}, ${quizRows(userId, input, view === "flashcards")},
    fd as (select day, count(*)::int as evaluations,
      count(*) filter(where rating='again')::int as again, count(*) filter(where rating='hard')::int as hard,
      count(*) filter(where rating='good')::int as good, count(*) filter(where rating='easy')::int as easy from f group by day),
    ed as (select day, count(*)::int as eligible, count(*) filter(where rating<>'again')::int as remembered from eligible group by day),
    qd as (select day, count(*)::int as answers, count(*) filter(where is_correct)::int as correct from q group by day),
    days as (select to_char(day,'YYYY-MM-DD') as day from generate_series(${input.from}::date, ${input.to}::date, interval '1 day') day)
    select jsonb_build_object(
      'evaluations', (select count(*) from f), 'cards', (select count(distinct flashcard_id) from f),
      'eligible', (select count(*) from eligible), 'remembered', (select count(*) from eligible where rating<>'again'),
      'again', (select count(*) from f where rating='again'), 'hard', (select count(*) from f where rating='hard'),
      'good', (select count(*) from f where rating='good'), 'easy', (select count(*) from f where rating='easy'),
      'quizAnswers', (select count(*) from q), 'quizCorrect', (select count(*) from q where is_correct),
      'attempts', (select count(distinct attempt_id) from q),
      'days', (select count(*) from (select day from f union select day from q) d)
    ) as summary,
    (select jsonb_agg(jsonb_build_object('date',d.day,'end',d.day,'evaluations',coalesce(fd.evaluations,0),
      'eligible',coalesce(ed.eligible,0),'remembered',coalesce(ed.remembered,0),
      'again',coalesce(fd.again,0),'hard',coalesce(fd.hard,0),'good',coalesce(fd.good,0),'easy',coalesce(fd.easy,0),
      'quizAnswers',coalesce(qd.answers,0),'quizCorrect',coalesce(qd.correct,0)) order by d.day)
      from days d left join fd using(day) left join ed using(day) left join qd using(day)) as series,
    (${view !== "quizzes"} and exists(select 1 from flashcard_review r join flashcard_practice_session s on s.id=r.session_id
      join flashcard d on d.id=r.flashcard_id join flashcard_collection c on c.id=d.collection_id
      where s.user_id=${userId} and c.user_id=${userId} ${collectionFilter(input.collectionId)}))
    or (${view !== "flashcards"} and exists(select 1 from quiz_attempt a join quiz_collection c on c.id=a.collection_id
      where a.user_id=${userId} and c.user_id=${userId} and a.status='completed' ${collectionFilter(input.collectionId)})) as history`;
}

async function aggregate(
  db: QueryExecutor,
  userId: string,
  input: StudyMetricsQuery,
  view: StudyMetricsView,
  cutoff?: string,
) {
  return (await db.execute(metricsAggregateQuery(userId, input, view, cutoff)))[0]!;
}

export const getStudyMetrics = async (
  db: QueryExecutor,
  userId: string,
  input: StudyMetricsQuery,
  view: StudyMetricsView,
  now = new Date(),
) => {
  // One consistent snapshot covers the summary, series and optional comparison.
  return db.transaction(
    async (tx) => {
      const window = comparisonWindow(input.from, input.to, input.tz, now);
      const current = await aggregate(tx, userId, input, view, window.currentCutoff);
      const previous =
        input.compare === "true"
          ? await aggregate(
              tx,
              userId,
              {
                ...input,
                from: window.previousFrom,
                to: window.previousTo,
                compare: "false",
              },
              view,
              window.previousCutoff,
            )
          : null;
      const grouped = groupMetricsDays(current.series as StudyMetricsPoint[]);
      return studyMetricsResponseSchema.parse({
        from: input.from,
        to: input.to,
        tz: input.tz,
        generatedAt: now.toISOString(),
        hasHistory: current.history,
        summary: current.summary,
        previous: previous?.summary ?? null,
        previousFrom: previous ? window.previousFrom : null,
        previousTo: previous ? window.previousTo : null,
        previousSeries: previous
          ? alignPreviousDays(grouped.series, previous.series as StudyMetricsPoint[], window.days)
          : null,
        ...grouped,
      });
    },
    { isolationLevel: "repeatable read" },
  );
};

type RankingInput = StudyMetricsQuery & {
  page: number;
  includeArchived: "true" | "false";
  order: "errors" | "correct";
};
export const getStudyRanking = async (
  db: QueryExecutor,
  userId: string,
  input: RankingInput,
  view: "flashcards" | "quizzes",
) => {
  const offset = (input.page - 1) * 5;
  const rows =
    view === "flashcards"
      ? await db.execute(sql`with ${bounds(input)}, ${flashcardRows(userId, input, false, true)},
    totals as (select flashcard_id, count(*)::int as total, count(*) filter(where rating<>'again')::int as successes,
      count(*) filter(where rating='again')::int as failures, count(distinct day)::int as days from eligible group by flashcard_id
      having count(*)>=${STUDY_METRICS_MIN_RANK} and count(distinct day)>=${STUDY_METRICS_MIN_RANK}),
    latest as (select distinct on(flashcard_id) * from f order by flashcard_id, reviewed_at desc, id desc),
    ratings as (select flashcard_id, count(*) filter(where rating='again')::int as again, count(*) filter(where rating='hard')::int as hard,
      count(*) filter(where rating='good')::int as good, count(*) filter(where rating='easy')::int as easy from f group by flashcard_id)
    select l.flashcard_id as id, l.title, l.collection_title as collection, l.collection_id as "collectionId",
      t.total, t.successes, t.failures, t.days, l.archived, false as historical, false as removed, null::text as "historicalHref",
      null::text as "currentHref",
      '/flashcards/'||l.collection_id||'?card='||l.flashcard_id||case when l.material_archived then '&status=archived' else '' end as href,
      to_char(l.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "lastAt", l.stability, l.difficulty, r.again,r.hard,r.good,r.easy
    from totals t join latest l using(flashcard_id) join ratings r using(flashcard_id)
    where t.failures>0 and (${input.includeArchived === "true"} or not l.archived)
    order by t.failures::float/t.total desc, t.failures desc, t.total desc, l.flashcard_id limit 6 offset ${offset}`)
      : await db.execute(sql`with ${bounds(input)}, ${quizRows(userId, input, false, true)},
    totals as (select original_question_id, question_fingerprint, count(*)::int as total,
      count(*) filter(where is_correct)::int as successes, count(*) filter(where not is_correct)::int as failures,
      count(distinct day)::int as days from q where original_question_id is not null and question_fingerprint is not null
      group by original_question_id,question_fingerprint having count(distinct attempt_id)>=${STUDY_METRICS_MIN_RANK}),
    latest as (select distinct on(original_question_id,question_fingerprint) * from q
      order by original_question_id,question_fingerprint,completed_at desc,id desc)
    select l.original_question_id||':'||l.question_fingerprint as id, lazuli_content_text(l.question) as title,
      l.collection_title as collection,l.collection_id as "collectionId", t.total,t.successes,t.failures,t.days,
      (l.collection_archived or d.archived_at is not null) as archived,
      d.id is null as removed,
      (d.id is null or l.question_fingerprint<>lazuli_quiz_fingerprint(d.content,
        (select jsonb_agg(jsonb_build_object('id',o.id,'text',o.text,'position',o.position) order by o.position) from quiz_option o where o.question_id=d.id),
        (select o.id from quiz_option o where o.question_id=d.id and o.is_correct))) as historical,
      '/quizzes/'||l.collection_id||'/attempts/'||l.attempt_id||'?item='||l.id as "historicalHref",
      case when d.id is not null then '/quizzes/'||l.collection_id||'?question='||d.id||case when d.archived_at is not null then '&status=archived' else '' end else null end as "currentHref",
      '/quizzes/'||l.collection_id||'/attempts/'||l.attempt_id||'?item='||l.id as href,
      to_char(l.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "lastAt",null::float as stability,null::float as difficulty,
      0::int as again,0::int as hard,0::int as good,0::int as easy
    from totals t join latest l using(original_question_id,question_fingerprint)
      left join quiz_question d on d.id=l.question_id
    where ${input.order === "correct" ? sql`t.successes` : sql`t.failures`}>0 and (${input.includeArchived === "true"} or not (l.collection_archived or d.archived_at is not null))
    order by ${input.order === "correct" ? sql`t.successes` : sql`t.failures`}::float/t.total desc,
      ${input.order === "correct" ? sql`t.successes` : sql`t.failures`} desc,t.total desc,l.original_question_id,l.question_fingerprint
    limit 6 offset ${offset}`);
  let emptyReason:
    | "noPractice"
    | "initial"
    | "noDifficulty"
    | "noSuccess"
    | "onlyArchived"
    | "outOfRange"
    | null = null;
  if (!rows.length) {
    if (input.page > 1) emptyReason = "outOfRange";
    else {
      const [state] =
        view === "flashcards"
          ? await db.execute(sql`with ${bounds(input)}, ${flashcardRows(userId, input)},
          t as (select flashcard_id, bool_or(archived) as archived, count(*)::int as n,
            count(*) filter(where rating='again')::int as failures from eligible group by flashcard_id having count(*)>=3)
          select (select count(*)::int from f) as practice, count(*)::int as qualified,
          count(*) filter(where failures>0)::int as matching,
          (select count(*) filter(where rating='again')::int from eligible) as failures from t`)
          : await db.execute(sql`with ${bounds(input)}, ${quizRows(userId, input, false, true)},
          t as (select original_question_id,question_fingerprint,
            count(*) filter(where is_correct)::int as successes, count(*) filter(where not is_correct)::int as failures
            from q where original_question_id is not null and question_fingerprint is not null group by original_question_id,question_fingerprint having count(distinct attempt_id)>=3)
          select (select count(*)::int from q) as practice, count(*)::int as qualified,
          count(*) filter(where ${input.order === "correct" ? sql`successes` : sql`failures`}>0)::int as matching,
          (select count(*) filter(where ${input.order === "correct" ? sql`is_correct` : sql`not is_correct`})::int from q) as failures from t`);
      emptyReason = !Number(state?.practice)
        ? "noPractice"
        : Number(state?.matching) > 0 && input.includeArchived !== "true"
          ? "onlyArchived"
          : !Number(state?.qualified) || Number(state?.failures) > 0
            ? "initial"
            : view === "quizzes" && input.order === "correct"
              ? "noSuccess"
              : "noDifficulty";
    }
  }
  return studyMetricsRankingSchema.parse({
    items: rows.slice(0, 5),
    hasMore: rows.length > 5,
    emptyReason,
    page: input.page,
  });
};

export const getStudyAttempts = async (
  db: QueryExecutor,
  userId: string,
  input: RankingInput & { recent?: "true" | "false" },
) => {
  const size = input.recent === "true" ? 3 : 5;
  const rows = await db.execute(sql`with ${bounds(input)} select a.id,c.title as collection,
    '/quizzes/'||c.id||'/attempts/'||a.id as href,to_char(a.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "completedAt",a.correct_answers as correct,a.total_questions as total
    from quiz_attempt a join quiz_collection c on c.id=a.collection_id and c.user_id=${userId} cross join bounds b
    where a.user_id=${userId} and a.status='completed' and a.completed_at>=b.start_at and a.completed_at<b.end_at
      ${collectionFilter(input.collectionId)} order by a.completed_at desc,a.id limit ${size + 1} offset ${(input.page - 1) * size}`);
  return studyMetricsAttemptsSchema.parse({
    items: rows.slice(0, size),
    hasMore: rows.length > size,
    page: input.page,
  });
};

export const getMetricsCollections = async (
  db: QueryExecutor,
  userId: string,
  view: "flashcards" | "quizzes",
  query: string,
  page: number,
  selectedId?: string,
) => {
  const table = view === "flashcards" ? sql`flashcard_collection` : sql`quiz_collection`;
  const search = query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  const rows =
    await db.execute(sql`select c.id,c.title,p.title as project,c.archived_at is not null as archived
    from ${table} c left join project p on p.id=c.project_id and p.user_id=${userId}
    where c.user_id=${userId} and c.title ilike ${`%${search}%`}
    order by (c.id=${selectedId ?? ""}) desc,c.title,c.id limit 21 offset ${(page - 1) * 20}`);
  return studyMetricsCollectionsSchema.parse({
    items: rows.slice(0, 20),
    hasMore: rows.length > 20,
  });
};
