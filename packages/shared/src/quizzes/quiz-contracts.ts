import { z } from "zod";

import { paginationSchema, projectIdSchema } from "../projects/project-contracts.ts";
import {
  createStudyCollectionSchema,
  STUDY_COLLECTION_MAX_PAGE_SIZE,
  STUDY_COLLECTION_PAGE_SIZE,
  studyCollectionIdSchema,
  studyCollectionListQueryShape,
  studyCollectionProjectFilterSchema,
  studyCollectionStatusSchema,
  studyCollectionTitleSchema,
  updateStudyCollectionSchema,
} from "../study-collections/study-collection-contracts.ts";

export const QUIZ_COLLECTION_PAGE_SIZE = STUDY_COLLECTION_PAGE_SIZE;
export const QUIZ_COLLECTION_MAX_PAGE_SIZE = STUDY_COLLECTION_MAX_PAGE_SIZE;

export const quizCollectionIdSchema = studyCollectionIdSchema;
export const quizCollectionTitleSchema = studyCollectionTitleSchema;
export const quizCollectionStatusSchema = studyCollectionStatusSchema;
export const quizCollectionProjectFilterSchema = studyCollectionProjectFilterSchema;
export const quizCollectionListQuerySchema = z.object(studyCollectionListQueryShape).strict();
export const createQuizCollectionSchema = createStudyCollectionSchema;
export const updateQuizCollectionSchema = updateStudyCollectionSchema;

const metricSchema = z.number().int().nonnegative();
const scoreSchema = z
  .object({
    correctAnswers: metricSchema,
    totalQuestions: z.number().int().positive(),
    rate: z.number().min(0).max(1),
  })
  .refine(({ correctAnswers, totalQuestions }) => correctAnswers <= totalQuestions, {
    message: "A pontuação da tentativa é inválida.",
  });

export const quizCollectionSummarySchema = z.object({
  id: quizCollectionIdSchema,
  title: z.string(),
  project: z.object({ id: projectIdSchema, title: z.string() }).nullable(),
  archivedAt: z.iso.datetime().nullable(),
  totalQuestions: metricSchema,
  totalAttempts: metricSchema,
  attemptsLastSevenDays: metricSchema,
  lastScore: scoreSchema.nullable(),
  bestScoreRate: z.number().min(0).max(1).nullable(),
  lastAttemptAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const quizCollectionListResponseSchema = z.object({
  items: z.array(quizCollectionSummarySchema),
  pagination: paginationSchema,
});

export type QuizCollectionListQuery = z.infer<typeof quizCollectionListQuerySchema>;
export type QuizCollectionStatus = z.infer<typeof quizCollectionStatusSchema>;
export type CreateQuizCollectionInput = z.infer<typeof createQuizCollectionSchema>;
export type UpdateQuizCollectionInput = z.infer<typeof updateQuizCollectionSchema>;
export type QuizCollectionSummary = z.infer<typeof quizCollectionSummarySchema>;
export type QuizCollectionListResponse = z.infer<typeof quizCollectionListResponseSchema>;
