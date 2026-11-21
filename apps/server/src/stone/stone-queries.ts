import {
  DEFAULT_STUDY_GOAL,
  GOAL_PRACTICE_ANSWERS,
  MASTERED_FLASHCARD_DAYS,
  MASTERED_QUESTION_DAYS,
  STONE_LEVELS,
  stoneShine,
  stoneLevelFor,
  type StoneContribution,
  type StoneDay,
  type StoneResponse,
  type StoneSessionKind,
  type StudyGoal,
  dateKeyIn,
  shiftDateKey,
} from "@lazuli/shared";
import { eq, sql } from "drizzle-orm";

import { flashcardMasteredAs } from "./mastery-sql.ts";
import type { Database } from "../database/client.ts";
import { user, userStoneLevel, userStudyGoal } from "../database/schema/index.ts";

const HISTORY_WEEKS = 12;
/** A session counts as just ended for this long: its summary may still celebrate. */
const FRESH_SESSION_MS = 30 * 60 * 1_000;

type PracticeEvent = { day: string; kind: "flashcards" | "quizzes" };
type Availability = { date: string; flashcards: boolean; quizzes: boolean };

/** Monday = 0 … Sunday = 6, for a YYYY-MM-DD key. */
const weekdayOf = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

const daysToBits = (days: boolean[]) =>
  days.reduce((bits, on, index) => (on ? bits | (1 << index) : bits), 0);
const bitsToDays = (bits: number) =>
  Array.from({ length: 7 }, (_, index) => Boolean(bits & (1 << index)));

const counts = (goal: StudyGoal, kind: PracticeEvent["kind"]) =>
  goal.counts === "both" || goal.counts === kind;

/**
 * Every day from `from` to `today` with its status, all judged by the current goal, so editing the
 * goal shows at once: met with enough practices, free when there was nothing to practice, off on
 * a day off.
 */
export const buildStoneDays = ({
  accountDay,
  availability,
  events,
  from,
  goal,
  today,
}: {
  accountDay: string;
  availability: Availability[];
  events: PracticeEvent[];
  from: string;
  goal: StudyGoal;
  today: string;
}): StoneDay[] => {
  const available = new Map(availability.map((item) => [item.date, item]));
  const days: StoneDay[] = [];
  for (let date = from; date <= today; date = shiftDateKey(date, 1)) {
    const practices = events.filter(
      (event) => event.day === date && counts(goal, event.kind),
    ).length;
    const open = available.get(date);
    const nothing = !(
      (counts(goal, "flashcards") && open?.flashcards) ||
      (counts(goal, "quizzes") && open?.quizzes)
    );
    const status: StoneDay["status"] =
      date < accountDay
        ? "none"
        : practices >= goal.practices
          ? "met"
          : !goal.days[weekdayOf(date)]
            ? "off"
            : nothing
              ? "free"
              : date === today
                ? "open"
                : "missed";
    days.push({ date, practices, status, studyDay: goal.days[weekdayOf(date)] ?? true });
  }
  return days;
};

/** Studied days of the last seven, and the days that could have been studied. */
export const weekShine = (week: StoneDay[]) => stoneShine(week);

/** The person's goal, or the default one until they set theirs. */
const readGoal = async (database: Database, userId: string): Promise<StudyGoal> => {
  const [row] = await database
    .select()
    .from(userStudyGoal)
    .where(eq(userStudyGoal.userId, userId))
    .limit(1);
  return row
    ? { counts: row.counts, practices: row.practices, days: bitsToDays(row.days) }
    : DEFAULT_STUDY_GOAL;
};

const dayStart = (date: string, timeZone: string) =>
  sql`(${date}::date::timestamp at time zone ${timeZone})`;

/*
 * When a practice counted for the goal: when it ended, or at its GOAL_PRACTICE_ANSWERS-th answer
 * if it stopped before the end. Written over the aliases `s` (flashcard_practice_session) and `a`
 * (quiz_attempt).
 */
const flashcardCountedAt = sql`case when s.status = 'completed' and s.reviewed_cards > 0 then s.finished_at
  else (select fr.reviewed_at from flashcard_review fr where fr.session_id = s.id
    order by fr.reviewed_at, fr.id offset ${GOAL_PRACTICE_ANSWERS - 1} limit 1) end`;
const quizCountedAt = sql`case when a.status = 'completed' then a.completed_at
  else (select i.answered_at from quiz_attempt_item i
    where i.attempt_id = a.id and i.answered_at is not null
    order by i.answered_at, i.id offset ${GOAL_PRACTICE_ANSWERS - 1} limit 1) end`;

/** Practices that count for the goal, each on the day it counted. */
const readPracticeEvents = async (
  database: Database,
  userId: string,
  from: string,
  timeZone: string,
): Promise<PracticeEvent[]> => {
  const start = dayStart(from, timeZone);
  const rows = await database.execute<{ kind: PracticeEvent["kind"]; day: string }>(sql`
    with events as (
      select 'flashcards' as kind, ${flashcardCountedAt} as counted_at
      from flashcard_practice_session s
      where s.user_id = ${userId} and s.last_activity_at >= ${start}
      union all
      select 'quizzes' as kind, ${quizCountedAt} as counted_at
      from quiz_attempt a
      where a.user_id = ${userId} and a.last_activity_at >= ${start}
    )
    select kind, to_char(counted_at at time zone ${timeZone}, 'YYYY-MM-DD') as day
    from events where counted_at >= ${start}`);
  return [...rows];
};

/**
 * Whether there was anything to practice each day: a flashcard new or due by the end of the day,
 * or any quiz question (a quiz can always be taken again).
 */
const readAvailability = async (
  database: Database,
  userId: string,
  from: string,
  today: string,
  timeZone: string,
): Promise<Availability[]> => {
  const rows = await database.execute<Availability>(sql`
    with days as (
      select gs::date as day,
        (gs::date::timestamp at time zone ${timeZone}) as day_start,
        ((gs::date + 1)::timestamp at time zone ${timeZone}) as day_end
      from generate_series(${from}::date, ${today}::date, interval '1 day') gs
    )
    select to_char(days.day, 'YYYY-MM-DD') as date,
      exists (
        select 1 from flashcard f
        join flashcard_collection c
          on c.id = f.collection_id and c.user_id = ${userId} and c.archived_at is null
        where f.archived_at is null and f.created_at < days.day_end
          and coalesce((
            select fr.next_due_at from flashcard_review fr
            where fr.flashcard_id = f.id and fr.reviewed_at < days.day_start
            order by fr.reviewed_at desc limit 1
          ), '-infinity'::timestamptz) < days.day_end
      ) as flashcards,
      exists (
        select 1 from quiz_question q
        join quiz_collection c
          on c.id = q.collection_id and c.user_id = ${userId} and c.archived_at is null
        where q.archived_at is null and q.created_at < days.day_end
      ) as quizzes
    from days order by days.day`);
  return [...rows];
};

/** Items that ever became mastered: the stone's count, which forgetting does not lower. */
const readEverMastered = async (database: Database, userId: string, timeZone: string) => {
  const [row] = await database.execute<{ flashcards: number; questions: number }>(sql`
    select
      (select count(distinct fr.flashcard_id) from flashcard_review fr
        join flashcard_practice_session s on s.id = fr.session_id and s.user_id = ${userId}
        where fr.scheduled_days >= ${MASTERED_FLASHCARD_DAYS})::int as flashcards,
      (select count(*) from (
        select i.question_id from quiz_attempt_item i
        join quiz_attempt a on a.id = i.attempt_id and a.user_id = ${userId}
        where i.is_correct and i.question_id is not null
        group by i.question_id
        having count(distinct (i.answered_at at time zone ${timeZone})::date) >= ${MASTERED_QUESTION_DAYS}
      ) mastered)::int as questions`);
  return (row?.flashcards ?? 0) + (row?.questions ?? 0);
};

/**
 * Items mastered right now, per project: a flashcard reviewed into a long interval and not
 * lapsed since; a question mastered whose latest answer is right.
 */
const readCurrentMastery = async (database: Database, userId: string, timeZone: string) => {
  const rows = await database.execute<{
    kind: PracticeEvent["kind"];
    projectId: string | null;
    title: string | null;
    mastered: number;
    total: number;
  }>(sql`
    with items as (
      select 'flashcards' as kind, c.project_id,
        ${flashcardMasteredAs("f")} as mastered
      from flashcard f
      join flashcard_collection c
        on c.id = f.collection_id and c.user_id = ${userId} and c.archived_at is null
      where f.archived_at is null
      union all
      select 'quizzes' as kind, c.project_id,
        coalesce((
          select count(distinct (i.answered_at at time zone ${timeZone})::date)
          from quiz_attempt_item i
          join quiz_attempt a on a.id = i.attempt_id and a.user_id = ${userId}
          where i.question_id = q.id and i.is_correct
        ) >= ${MASTERED_QUESTION_DAYS} and (
          select i.is_correct from quiz_attempt_item i
          join quiz_attempt a on a.id = i.attempt_id and a.user_id = ${userId}
          where i.question_id = q.id and i.answered_at is not null
          order by i.answered_at desc limit 1
        ), false) as mastered
      from quiz_question q
      join quiz_collection c
        on c.id = q.collection_id and c.user_id = ${userId} and c.archived_at is null
      where q.archived_at is null
    )
    select items.kind, items.project_id as "projectId", p.title,
      (count(*) filter (where items.mastered))::int as mastered, count(*)::int as total
    from items left join project p on p.id = items.project_id
    group by items.kind, items.project_id, p.title
    order by p.title nulls last`);
  return [...rows];
};

/** Records every level the count reached and returns them; the stone's level is the highest. */
const syncLevels = async (database: Database, userId: string, mastered: number, now: Date) => {
  const reached = stoneLevelFor(mastered).level;
  const missing = STONE_LEVELS.filter(({ level }) => level > 1 && level <= reached);
  if (missing.length)
    await database
      .insert(userStoneLevel)
      .values(missing.map(({ level }) => ({ userId, level, reachedAt: now })))
      .onConflictDoNothing();
  return database
    .select({ level: userStoneLevel.level, reachedAt: userStoneLevel.reachedAt })
    .from(userStoneLevel)
    .where(eq(userStoneLevel.userId, userId));
};

const historyStartFor = (today: string) =>
  shiftDateKey(today, -weekdayOf(today) - (HISTORY_WEEKS - 1) * 7);

export const getStone = async (
  database: Database,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<StoneResponse> => {
  const today = dateKeyIn(now, timeZone);
  const from = historyStartFor(today);
  const [account, goal, events, availability, everMastered, current] = await Promise.all([
    database.query.user.findFirst({ columns: { createdAt: true }, where: eq(user.id, userId) }),
    readGoal(database, userId),
    readPracticeEvents(database, userId, from, timeZone),
    readAvailability(database, userId, from, today, timeZone),
    readEverMastered(database, userId, timeZone),
    readCurrentMastery(database, userId, timeZone),
  ]);
  const accountDay = account ? dateKeyIn(account.createdAt, timeZone) : from;
  const levels = await syncLevels(database, userId, everMastered, now);
  const history = buildStoneDays({ accountDay, availability, events, from, goal, today });
  const week = history.slice(-7);
  const { dull, kept, planned } = weekShine(week);
  const level = Math.max(1, ...levels.map((item) => item.level));
  const totals = current.reduce(
    (sum, row) => ({ mastered: sum.mastered + row.mastered, total: sum.total + row.total }),
    { mastered: 0, total: 0 },
  );
  // Nothing at all to practice for the goal: it waits for material instead of counting days.
  const paused = !current.some((row) => row.total > 0 && counts(goal, row.kind));
  const projects = new Map<string, StoneResponse["projects"][number]>();
  for (const row of current) {
    if (!row.projectId || !row.title) continue;
    const project = projects.get(row.projectId) ?? {
      projectId: row.projectId,
      title: row.title,
      mastered: 0,
      total: 0,
    };
    project.mastered += row.mastered;
    project.total += row.total;
    projects.set(row.projectId, project);
  }
  const reachedAt = new Map(levels.map((item) => [item.level, item.reachedAt.toISOString()]));
  return {
    level,
    mastered: everMastered,
    notMastered: totals.total - totals.mastered,
    paused,
    dull,
    keptDays: kept,
    plannedDays: planned,
    goal,
    history,
    levels: STONE_LEVELS.map((item) => ({
      level: item.level,
      reachedAt:
        item.level === 1
          ? (account?.createdAt.toISOString() ?? null)
          : (reachedAt.get(item.level) ?? null),
    })),
    projects: [...projects.values()],
  };
};

export const updateStudyGoal = async (
  database: Database,
  userId: string,
  goal: StudyGoal,
  now = new Date(),
) => {
  const values = {
    counts: goal.counts,
    practices: goal.practices,
    days: daysToBits(goal.days),
    updatedAt: now,
  };
  await database
    .insert(userStudyGoal)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userStudyGoal.userId, set: values });
  return goal;
};

/**
 * What one practice or quiz added, for its summary: whether it counted for today's goal, items it
 * made mastered for the first time and the level before and after.
 */
export const getStoneContribution = async (
  database: Database,
  userId: string,
  kind: StoneSessionKind,
  id: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<StoneContribution | null> => {
  const today = dateKeyIn(now, timeZone);
  const [session] =
    kind === "flashcards"
      ? await database.execute<{
          startedAt: Date;
          lastActivityAt: Date;
          countedDay: string | null;
          gained: number;
        }>(sql`
          select s.started_at as "startedAt", s.last_activity_at as "lastActivityAt",
            to_char((${flashcardCountedAt}) at time zone ${timeZone}, 'YYYY-MM-DD') as "countedDay",
            (select count(*) from (
              select distinct on (fr.flashcard_id) fr.flashcard_id, fr.session_id
              from flashcard_review fr
              where fr.scheduled_days >= ${MASTERED_FLASHCARD_DAYS}
                and fr.flashcard_id in (
                  select flashcard_id from flashcard_review
                  where session_id = s.id and scheduled_days >= ${MASTERED_FLASHCARD_DAYS})
              order by fr.flashcard_id, fr.reviewed_at, fr.id
            ) first where first.session_id = s.id)::int as gained
          from flashcard_practice_session s
          where s.id = ${id} and s.user_id = ${userId}`)
      : await database.execute<{
          startedAt: Date;
          lastActivityAt: Date;
          countedDay: string | null;
          gained: number;
        }>(sql`
          select a.started_at as "startedAt", a.last_activity_at as "lastActivityAt",
            to_char((${quizCountedAt}) at time zone ${timeZone}, 'YYYY-MM-DD') as "countedDay",
            -- A question counts for the attempt holding the first right answer on its
            -- MASTERED_QUESTION_DAYS-th day: the one that made it mastered, and no other.
            (select count(*) from (
              select i.attempt_id,
                dense_rank() over (
                  partition by i.question_id
                  order by (i.answered_at at time zone ${timeZone})::date
                ) as day_rank,
                row_number() over (
                  partition by i.question_id, (i.answered_at at time zone ${timeZone})::date
                  order by i.answered_at, i.id
                ) as in_day
              from quiz_attempt_item i
              join quiz_attempt o on o.id = i.attempt_id and o.user_id = ${userId}
              where i.is_correct and i.question_id in (
                select question_id from quiz_attempt_item
                where attempt_id = a.id and is_correct and question_id is not null)
            ) q where q.day_rank = ${MASTERED_QUESTION_DAYS} and q.in_day = 1
              and q.attempt_id = a.id)::int as gained
          from quiz_attempt a
          where a.id = ${id} and a.user_id = ${userId}`);
  if (!session) return null;
  // Only what the summary shows: today's goal, and the mastery with its levels (not the history).
  const [goal, events, mastered] = await Promise.all([
    readGoal(database, userId),
    readPracticeEvents(database, userId, today, timeZone),
    readEverMastered(database, userId, timeZone),
  ]);
  const levels = await syncLevels(database, userId, mastered, now);
  const level = Math.max(1, ...levels.map((item) => item.level));
  const counted =
    session.countedDay === today && counts(goal, kind === "quiz" ? "quizzes" : "flashcards");
  const after = events.filter((event) => event.day === today && counts(goal, event.kind)).length;
  const startedAt = new Date(session.startedAt);
  const levelsBefore = levels
    .filter(({ reachedAt }) => reachedAt < startedAt)
    .map((item) => item.level);
  const levelBefore = Math.max(
    stoneLevelFor(Math.max(0, mastered - session.gained)).level,
    ...levelsBefore,
  );
  return {
    counted,
    // Just ended: the moment (and the level-up) belongs to the summary seen right after it.
    fresh: now.getTime() - new Date(session.lastActivityAt).getTime() < FRESH_SESSION_MS,
    goal: { before: Math.max(0, after - (counted ? 1 : 0)), after, target: goal.practices },
    masteredGained: session.gained,
    mastered,
    levelBefore: Math.min(levelBefore, level),
    level,
  };
};
