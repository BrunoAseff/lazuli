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
} from "@lazuli/shared";
import { eq, sql } from "drizzle-orm";

import { dateKeyInTimeZone, shiftDateKey } from "../dashboard/dashboard-queries.ts";
import type { Database } from "../database/client.ts";
import { user, userStoneLevel, userStudyGoal } from "../database/schema/index.ts";

const HISTORY_WEEKS = 12;

type GoalVersion = StudyGoal & { effectiveFrom: string };
type PracticeEvent = { day: string; kind: "flashcards" | "quizzes" };
type Availability = { date: string; flashcards: boolean; quizzes: boolean };

/** Monday = 0 … Sunday = 6, for a YYYY-MM-DD key. */
const weekdayOf = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

const daysToBits = (days: boolean[]) =>
  days.reduce((bits, on, index) => (on ? bits | (1 << index) : bits), 0);
const bitsToDays = (bits: number) =>
  Array.from({ length: 7 }, (_, index) => Boolean(bits & (1 << index)));

/** The goal in force on a day: the latest change made on or before it. */
export const goalOn = (versions: GoalVersion[], date: string): StudyGoal => {
  let goal: StudyGoal = DEFAULT_STUDY_GOAL;
  for (const version of versions) if (version.effectiveFrom <= date) goal = version;
  return { counts: goal.counts, practices: goal.practices, days: goal.days };
};

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
  goals,
  today,
}: {
  accountDay: string;
  availability: Availability[];
  events: PracticeEvent[];
  from: string;
  goals: GoalVersion[];
  today: string;
}): StoneDay[] => {
  const available = new Map(availability.map((item) => [item.date, item]));
  const days: StoneDay[] = [];
  const goal = goalOn(goals, today);
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

const readGoals = async (database: Database, userId: string): Promise<GoalVersion[]> => {
  const rows = await database
    .select()
    .from(userStudyGoal)
    .where(eq(userStudyGoal.userId, userId))
    .orderBy(userStudyGoal.effectiveFrom);
  return rows.map((row) => ({
    effectiveFrom: row.effectiveFrom,
    counts: row.counts,
    practices: row.practices,
    days: bitsToDays(row.days),
  }));
};

const dayStart = (date: string, timeZone: string) =>
  sql`(${date}::date::timestamp at time zone ${timeZone})`;

/**
 * Practices that count for the goal, each on the day it counted: when it ended, or at its
 * GOAL_PRACTICE_ANSWERS-th answer if it stopped before the end.
 */
const readPracticeEvents = async (
  database: Database,
  userId: string,
  from: string,
  timeZone: string,
): Promise<PracticeEvent[]> => {
  const start = dayStart(from, timeZone);
  const offset = GOAL_PRACTICE_ANSWERS - 1;
  const rows = await database.execute<{ kind: PracticeEvent["kind"]; day: string }>(sql`
    with events as (
      select 'flashcards' as kind,
        case when s.status = 'completed' and s.reviewed_cards > 0 then s.finished_at
          else (select fr.reviewed_at from flashcard_review fr where fr.session_id = s.id
            order by fr.reviewed_at, fr.id offset ${offset} limit 1)
        end as counted_at
      from flashcard_practice_session s
      where s.user_id = ${userId} and s.last_activity_at >= ${start}
      union all
      select 'quizzes' as kind,
        case when a.status = 'completed' then a.completed_at
          else (select i.answered_at from quiz_attempt_item i
            where i.attempt_id = a.id and i.answered_at is not null
            order by i.answered_at, i.id offset ${offset} limit 1)
        end as counted_at
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
        (f.srs_state = 'review' and f.scheduled_days >= ${MASTERED_FLASHCARD_DAYS}) as mastered
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
  const today = dateKeyInTimeZone(now, timeZone);
  const from = historyStartFor(today);
  const [account, goals, events, availability, everMastered, current] = await Promise.all([
    database.query.user.findFirst({ columns: { createdAt: true }, where: eq(user.id, userId) }),
    readGoals(database, userId),
    readPracticeEvents(database, userId, from, timeZone),
    readAvailability(database, userId, from, today, timeZone),
    readEverMastered(database, userId, timeZone),
    readCurrentMastery(database, userId, timeZone),
  ]);
  const accountDay = account ? dateKeyInTimeZone(account.createdAt, timeZone) : from;
  const levels = await syncLevels(database, userId, everMastered, now);
  const history = buildStoneDays({ accountDay, availability, events, from, goals, today });
  const week = history.slice(-7);
  const { dull, kept, planned } = weekShine(week);
  const goal = goalOn(goals, today);
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
    today: history.at(-1)!,
    week,
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
  timeZone = "UTC",
  now = new Date(),
) => {
  const effectiveFrom = dateKeyInTimeZone(now, timeZone);
  const values = {
    counts: goal.counts,
    practices: goal.practices,
    days: daysToBits(goal.days),
    updatedAt: now,
  };
  await database
    .insert(userStudyGoal)
    .values({ userId, effectiveFrom, ...values })
    .onConflictDoUpdate({
      target: [userStudyGoal.userId, userStudyGoal.effectiveFrom],
      set: values,
    });
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
  const today = dateKeyInTimeZone(now, timeZone);
  const offset = GOAL_PRACTICE_ANSWERS - 1;
  const [session] =
    kind === "flashcards"
      ? await database.execute<{ startedAt: Date; countedDay: string | null; gained: number }>(sql`
          select s.started_at as "startedAt",
            to_char((case when s.status = 'completed' and s.reviewed_cards > 0 then s.finished_at
              else (select fr.reviewed_at from flashcard_review fr where fr.session_id = s.id
                order by fr.reviewed_at, fr.id offset ${offset} limit 1) end)
              at time zone ${timeZone}, 'YYYY-MM-DD') as "countedDay",
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
      : await database.execute<{ startedAt: Date; countedDay: string | null; gained: number }>(sql`
          select a.started_at as "startedAt",
            to_char((case when a.status = 'completed' then a.completed_at
              else (select i.answered_at from quiz_attempt_item i
                where i.attempt_id = a.id and i.answered_at is not null
                order by i.answered_at, i.id offset ${offset} limit 1) end)
              at time zone ${timeZone}, 'YYYY-MM-DD') as "countedDay",
            (select count(*) from (
              select i.question_id,
                count(distinct (i.answered_at at time zone ${timeZone})::date) as all_days,
                count(distinct (i.answered_at at time zone ${timeZone})::date)
                  filter (where i.attempt_id <> a.id) as other_days
              from quiz_attempt_item i
              join quiz_attempt o on o.id = i.attempt_id and o.user_id = ${userId}
              where i.is_correct and i.question_id in (
                select question_id from quiz_attempt_item
                where attempt_id = a.id and is_correct and question_id is not null)
              group by i.question_id
            ) q where q.all_days >= ${MASTERED_QUESTION_DAYS}
              and q.other_days < ${MASTERED_QUESTION_DAYS})::int as gained
          from quiz_attempt a
          where a.id = ${id} and a.user_id = ${userId}`);
  if (!session) return null;
  const stone = await getStone(database, userId, timeZone, now);
  const counted =
    session.countedDay === today && counts(stone.goal, kind === "quiz" ? "quizzes" : "flashcards");
  const after = stone.today.practices;
  const startedAt = new Date(session.startedAt);
  const levelsBefore = stone.levels
    .filter(({ reachedAt }) => reachedAt && new Date(reachedAt) < startedAt)
    .map(({ level }) => level);
  const levelBefore = Math.max(
    stoneLevelFor(Math.max(0, stone.mastered - session.gained)).level,
    ...levelsBefore,
  );
  return {
    counted,
    goal: { before: Math.max(0, after - (counted ? 1 : 0)), after, target: stone.goal.practices },
    masteredGained: session.gained,
    mastered: stone.mastered,
    levelBefore: Math.min(levelBefore, stone.level),
    level: stone.level,
  };
};
