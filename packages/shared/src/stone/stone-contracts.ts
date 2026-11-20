import { z } from "zod";

/*
 * "Sua pedra": the person's gamification. Mastery gives the level (the stone's cut) and never
 * takes it back; the week of studied days gives the shine. The daily goal is the person's own:
 * a number of practices (a flashcard practice or a quiz), not items or time.
 */

/** Five levels, the five cuts the stone has. The thresholds are the same for everyone. */
export const STONE_LEVELS = [
  { level: 1, name: "Bruta", from: 0, cut: 0 },
  { level: 2, name: "Desbastada", from: 15, cut: 0.4 },
  { level: 3, name: "Facetada", from: 50, cut: 0.62 },
  { level: 4, name: "Lapidada", from: 150, cut: 0.85 },
  { level: 5, name: "Polida", from: 400, cut: 1 },
] as const;

export type StoneLevel = (typeof STONE_LEVELS)[number];

export const stoneLevelFor = (mastered: number): StoneLevel =>
  [...STONE_LEVELS].reverse().find(({ from }) => mastered >= from) ?? STONE_LEVELS[0];

export const stoneLevelByNumber = (level: number): StoneLevel =>
  STONE_LEVELS.find((item) => item.level === level) ?? STONE_LEVELS[0];

export const nextStoneLevel = (level: number): StoneLevel | null =>
  STONE_LEVELS.find((item) => item.level === level + 1) ?? null;

/** A flashcard is mastered once the review schedules it this many days ahead. */
export const MASTERED_FLASHCARD_DAYS = 21;
/** A question is mastered once answered right on this many different days. */
export const MASTERED_QUESTION_DAYS = 2;
/** A practice counts for the goal when it ends, or after this many answers. */
export const GOAL_PRACTICE_ANSWERS = 20;
/** Fewer studied days than this in the last seven dull the stone (days off excepted). */
export const STONE_SHINE_DAYS = 4;

export const STUDY_GOAL_MIN = 1;
export const STUDY_GOAL_MAX = 10;
export const STUDY_GOAL_DEFAULT = 2;

export const studyGoalCountsSchema = z.enum(["both", "flashcards", "quizzes"]);

/** Days run Monday (0) to Sunday (6). */
export const studyGoalSchema = z
  .object({
    counts: studyGoalCountsSchema,
    practices: z.number().int().min(STUDY_GOAL_MIN).max(STUDY_GOAL_MAX),
    days: z
      .array(z.boolean())
      .length(7)
      .refine((days) => days.some(Boolean), "Escolha ao menos um dia de estudo."),
  })
  .strict();

export const updateStudyGoalSchema = z
  .object({ goal: studyGoalSchema, tz: z.string().trim().min(1).max(100).optional() })
  .strict();

export const stoneQuerySchema = z
  .object({ tz: z.string().trim().min(1).max(100).optional() })
  .strict();

/**
 * A day: met (the goal, or more), missed, off (a day off with no goal), free (nothing to practice,
 * counts as met), open (today, not met yet) or none (before the account existed).
 */
export const stoneDayStatusSchema = z.enum(["met", "missed", "off", "free", "open", "none"]);

export const stoneDaySchema = z.object({
  date: z.iso.date(),
  practices: z.number().int().nonnegative(),
  status: stoneDayStatusSchema,
});

export const stoneProjectSchema = z.object({
  projectId: z.string(),
  title: z.string(),
  mastered: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const stoneResponseSchema = z.object({
  level: z.number().int().min(1).max(5),
  /** Items that ever became mastered: forgetting one later does not take it from the stone. */
  mastered: z.number().int().nonnegative(),
  /** Items not mastered right now, so the page can say when there is not enough to go on. */
  notMastered: z.number().int().nonnegative(),
  /** True when the person has nothing at all to practice for their goal: the goal is paused. */
  paused: z.boolean(),
  /** 0 (full shine) to 1 (dull), from the studied days of the last seven. */
  dull: z.number().min(0).max(1),
  studiedDays: z.number().int().min(0).max(7),
  goal: studyGoalSchema,
  today: stoneDaySchema,
  week: z.array(stoneDaySchema).length(7),
  /** From the Monday eleven weeks back to today, in order. */
  history: z.array(stoneDaySchema).max(84),
  levels: z.array(
    z.object({ level: z.number().int().min(1).max(5), reachedAt: z.iso.datetime().nullable() }),
  ),
  projects: z.array(stoneProjectSchema),
});

export const stoneSessionKindSchema = z.enum(["flashcards", "quiz"]);

/** What one practice or quiz added: the goal of today, new mastered items and the level. */
export const stoneContributionSchema = z.object({
  counted: z.boolean(),
  goal: z.object({
    before: z.number().int().nonnegative(),
    after: z.number().int().nonnegative(),
    target: z.number().int().positive(),
  }),
  masteredGained: z.number().int().nonnegative(),
  mastered: z.number().int().nonnegative(),
  levelBefore: z.number().int().min(1).max(5),
  level: z.number().int().min(1).max(5),
});

export type UpdateStudyGoalInput = z.infer<typeof updateStudyGoalSchema>;
export type StudyGoal = z.infer<typeof studyGoalSchema>;
export type StudyGoalCounts = z.infer<typeof studyGoalCountsSchema>;
export type StoneDay = z.infer<typeof stoneDaySchema>;
export type StoneDayStatus = z.infer<typeof stoneDayStatusSchema>;
export type StoneResponse = z.infer<typeof stoneResponseSchema>;
export type StoneContribution = z.infer<typeof stoneContributionSchema>;
export type StoneSessionKind = z.infer<typeof stoneSessionKindSchema>;

export const DEFAULT_STUDY_GOAL: StudyGoal = {
  counts: "both",
  practices: STUDY_GOAL_DEFAULT,
  days: [true, true, true, true, true, true, true],
};

/**
 * The shine of the last seven days: the stone shines with STONE_SHINE_DAYS studied days, and each
 * day off the person chose excuses one. Days before the account are not excused: one rule, said
 * the same way everywhere. Today counts once it is studied.
 */
export const stoneShine = (week: Array<Pick<StoneDay, "status">>) => {
  const studied = week.filter(({ status }) => status === "met" || status === "free").length;
  const daysOff = week.filter(({ status }) => status === "off").length;
  const needed = Math.max(0, Math.min(STONE_SHINE_DAYS, week.length - daysOff));
  const dull = needed ? Math.max(0, Math.min(1, (needed - studied) / needed)) : 0;
  return { studied, needed, excused: STONE_SHINE_DAYS - needed, dull };
};
