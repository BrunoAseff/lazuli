import { z } from "zod";

export const STUDY_METRICS_MIN_SAMPLE = 20;
export const STUDY_METRICS_MIN_POINT = 5;
export const STUDY_METRICS_MIN_RANK = 3;
export const studyMetricsViewSchema = z.enum(["overview", "flashcards", "quizzes"]);
export type StudyMetricsView = z.infer<typeof studyMetricsViewSchema>;
const date = z.iso.date();
export const studyMetricsQuerySchema = z.object({
  from: date,
  to: date,
  tz: z.string().min(1).max(100),
  collectionId: z.uuid().optional(),
  compare: z.enum(["true", "false"]).default("false"),
});
export type StudyMetricsQuery = z.infer<typeof studyMetricsQuerySchema>;
export const studyMetricsListQuerySchema = studyMetricsQuerySchema.extend({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  includeArchived: z.enum(["true", "false"]).default("false"),
  order: z.enum(["errors", "correct"]).default("errors"),
  recent: z.enum(["true", "false"]).default("false"),
});
const count = z.number().int().nonnegative();
export const studyMetricsSummarySchema = z.object({
  evaluations: count,
  cards: count,
  eligible: count,
  remembered: count,
  again: count,
  hard: count,
  good: count,
  easy: count,
  quizAnswers: count,
  quizCorrect: count,
  attempts: count,
  days: count,
});
export const studyMetricsPointSchema = z.object({
  date,
  end: date,
  evaluations: count,
  eligible: count,
  remembered: count,
  again: count,
  hard: count,
  good: count,
  easy: count,
  quizAnswers: count,
  quizCorrect: count,
});
export const studyMetricsResponseSchema = z.object({
  from: date,
  to: date,
  tz: z.string(),
  bucket: z.enum(["day", "week", "month"]),
  generatedAt: z.iso.datetime(),
  hasHistory: z.boolean(),
  summary: studyMetricsSummarySchema,
  previous: studyMetricsSummarySchema.nullable(),
  previousFrom: date.nullable(),
  previousTo: date.nullable(),
  previousSeries: z.array(studyMetricsPointSchema).nullable(),
  series: z.array(studyMetricsPointSchema),
});
export type StudyMetricsResponse = z.infer<typeof studyMetricsResponseSchema>;
export type StudyMetricsPoint = z.infer<typeof studyMetricsPointSchema>;
export const studyMetricsRankingSchema = z.object({
  emptyReason: z
    .enum(["noPractice", "initial", "noDifficulty", "noSuccess", "onlyArchived", "outOfRange"])
    .nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      collection: z.string(),
      collectionId: z.string(),
      total: count,
      successes: count,
      failures: count,
      days: count,
      href: z.string(),
      historicalHref: z.string().nullable(),
      currentHref: z.string().nullable(),
      archived: z.boolean(),
      historical: z.boolean(),
      removed: z.boolean(),
      lastAt: z.iso.datetime(),
      stability: z.number().nullable(),
      difficulty: z.number().nullable(),
      again: count,
      hard: count,
      good: count,
      easy: count,
    }),
  ),
  hasMore: z.boolean(),
  page: count,
});
export const studyMetricsAttemptsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      collection: z.string(),
      href: z.string(),
      completedAt: z.iso.datetime(),
      correct: count,
      total: count,
    }),
  ),
  hasMore: z.boolean(),
  page: count,
});
export const studyMetricsCollectionsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      project: z.string().nullable(),
      archived: z.boolean(),
    }),
  ),
  hasMore: z.boolean(),
});
export type StudyMetricsCollections = z.infer<typeof studyMetricsCollectionsSchema>;
