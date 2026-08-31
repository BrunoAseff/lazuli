import { z } from "zod";

import { paginationSchema, projectIdSchema } from "../projects/project-contracts.ts";
import { documentContentSchema } from "../documents/document-contracts.ts";
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
export const QUIZ_QUESTION_PAGE_SIZE = 25;
export const QUIZ_QUESTION_MAX_PAGE_SIZE = 100;
export const QUIZ_MAX_CONTENT_BYTES = 256 * 1024;
export const QUIZ_ATTEMPT_MAX_QUESTIONS = 200;

export const quizCollectionIdSchema = studyCollectionIdSchema;
export const quizCollectionTitleSchema = studyCollectionTitleSchema;
export const quizCollectionStatusSchema = studyCollectionStatusSchema;
export const quizCollectionProjectFilterSchema = studyCollectionProjectFilterSchema;
export const quizCollectionListQuerySchema = z.object(studyCollectionListQueryShape).strict();
export const createQuizCollectionSchema = createStudyCollectionSchema;
export const updateQuizCollectionSchema = updateStudyCollectionSchema;
export const quizQuestionIdSchema = z.uuid();
export const quizOptionIdSchema = z.uuid();
export const quizAttemptIdSchema = z.uuid();
export const quizAttemptItemIdSchema = z.uuid();
export const quizQuestionStatusSchema = z.enum(["active", "archived"]);
export const quizQuestionSortSchema = z.enum(["updated", "created", "position"]);

const utf8ByteLength = (value: string) => {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
};
const hasMeaningfulContent = (blocks: z.infer<typeof documentContentSchema>) => {
  const pending = [...blocks];
  while (pending.length) {
    const block = pending.pop()!;
    if (block.type === "image") return true;
    if (
      block.content?.some((item) =>
        item.type === "text" ? item.text.trim() : item.content.some(({ text }) => text.trim()),
      )
    )
      return true;
    if (block.children) pending.push(...block.children);
  }
  return false;
};

export const quizQuestionContentSchema = documentContentSchema.superRefine((content, context) => {
  if (utf8ByteLength(JSON.stringify(content)) > QUIZ_MAX_CONTENT_BYTES)
    context.addIssue({ code: "custom", message: "A pergunta deve ter no máximo 256 KB." });
  if (!hasMeaningfulContent(content))
    context.addIssue({ code: "custom", message: "Informe uma pergunta." });
});

export const quizOptionInputSchema = z
  .object({
    id: quizOptionIdSchema,
    text: z.string().trim().min(1, "Informe o texto da alternativa.").max(1_000),
    isCorrect: z.boolean(),
  })
  .strict();

const questionInputShape = {
  content: quizQuestionContentSchema,
  options: z.array(quizOptionInputSchema).min(2).max(6),
};
const validateOptions = (
  value: { options: Array<{ text: string; isCorrect: boolean }> },
  context: z.RefinementCtx,
) => {
  if (value.options.filter(({ isCorrect }) => isCorrect).length !== 1)
    context.addIssue({
      code: "custom",
      path: ["options"],
      message: "Escolha exatamente uma alternativa correta.",
    });
  const normalized = value.options.map(({ text }) => text.trim().toLocaleLowerCase("pt-BR"));
  if (new Set(normalized).size !== normalized.length)
    context.addIssue({
      code: "custom",
      path: ["options"],
      message: "As alternativas devem ser diferentes.",
    });
  const ids = value.options.map((option) => ("id" in option ? String(option.id) : ""));
  if (new Set(ids).size !== ids.length)
    context.addIssue({
      code: "custom",
      path: ["options"],
      message: "As alternativas são inválidas.",
    });
};

export const createQuizQuestionSchema = z
  .object({ id: quizQuestionIdSchema, ...questionInputShape })
  .strict()
  .superRefine(validateOptions);
export const updateQuizQuestionSchema = z
  .object({
    content: quizQuestionContentSchema.optional(),
    options: z.array(quizOptionInputSchema).min(2).max(6).optional(),
    collectionId: quizCollectionIdSchema.optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Informe ao menos uma alteração.",
  })
  .superRefine(
    (value, context) => value.options && validateOptions({ options: value.options }, context),
  );

export const quizQuestionListQuerySchema = z
  .object({
    query: z.string().trim().max(200).default(""),
    status: quizQuestionStatusSchema.default("active"),
    sort: quizQuestionSortSchema.default("updated"),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(QUIZ_QUESTION_MAX_PAGE_SIZE)
      .default(QUIZ_QUESTION_PAGE_SIZE),
  })
  .strict();

export const quizOptionSchema = quizOptionInputSchema.extend({
  position: z.number().int().nonnegative(),
});
export const quizQuestionSummarySchema = z.object({
  id: quizQuestionIdSchema,
  collectionId: quizCollectionIdSchema,
  contentText: z.string(),
  hasImage: z.boolean(),
  optionCount: z.number().int().min(2).max(6),
  correctOptionText: z.string(),
  position: z.number().int().nonnegative(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const quizQuestionDetailSchema = quizQuestionSummarySchema.extend({
  content: quizQuestionContentSchema,
  contentSchemaVersion: z.number().int().positive(),
  options: z.array(quizOptionSchema).min(2).max(6),
});
export const quizQuestionListResponseSchema = z.object({
  items: z.array(quizQuestionSummarySchema),
  pagination: paginationSchema,
});

export const createQuizAttemptSchema = z
  .object({ id: quizAttemptIdSchema, abandonActive: z.boolean().default(false) })
  .strict();
export const answerQuizAttemptItemSchema = z.object({ optionId: quizOptionIdSchema }).strict();
export const quizAttemptStatusSchema = z.enum(["active", "completed", "abandoned"]);
const attemptOptionSchema = z.object({
  id: quizOptionIdSchema,
  text: z.string(),
  position: z.number().int().nonnegative(),
});
const attemptItemBaseSchema = z.object({
  id: quizAttemptItemIdSchema,
  questionId: quizQuestionIdSchema,
  referenceCount: z.number().int().nonnegative(),
  position: z.number().int().nonnegative(),
  question: quizQuestionContentSchema,
  options: z.array(attemptOptionSchema).min(2).max(6),
  selectedOptionId: quizOptionIdSchema.nullable(),
  answeredAt: z.iso.datetime().nullable(),
});
export const activeQuizAttemptItemSchema = attemptItemBaseSchema;
export const resultQuizAttemptItemSchema = attemptItemBaseSchema.extend({
  correctOptionId: quizOptionIdSchema,
  isCorrect: z.boolean(),
});
const attemptBaseSchema = z.object({
  id: quizAttemptIdSchema,
  collectionId: quizCollectionIdSchema,
  collectionTitle: z.string(),
  status: quizAttemptStatusSchema,
  totalQuestions: z.number().int().positive(),
  answeredQuestions: z.number().int().nonnegative(),
  correctAnswers: z.number().int().nonnegative(),
  startedAt: z.iso.datetime(),
  lastActivityAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export const activeQuizAttemptSchema = attemptBaseSchema.extend({
  status: z.literal("active"),
  items: z.array(activeQuizAttemptItemSchema),
});
export const quizAttemptResumeSchema = attemptBaseSchema.extend({ status: z.literal("active") });
export const completedQuizAttemptSchema = attemptBaseSchema.extend({
  status: z.literal("completed"),
  items: z.array(resultQuizAttemptItemSchema),
});
export const quizAttemptSchema = z.discriminatedUnion("status", [
  activeQuizAttemptSchema,
  completedQuizAttemptSchema,
]);
export const quizAttemptAvailabilitySchema = z.object({
  activeAttempt: quizAttemptResumeSchema.nullable(),
  archived: z.boolean(),
  totalQuestions: z.number().int().nonnegative(),
});

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
export type QuizQuestionListQuery = z.infer<typeof quizQuestionListQuerySchema>;
export type CreateQuizQuestionInput = z.infer<typeof createQuizQuestionSchema>;
export type UpdateQuizQuestionInput = z.infer<typeof updateQuizQuestionSchema>;
export type QuizQuestionSummary = z.infer<typeof quizQuestionSummarySchema>;
export type QuizQuestionDetail = z.infer<typeof quizQuestionDetailSchema>;
export type QuizQuestionListResponse = z.infer<typeof quizQuestionListResponseSchema>;
export type CreateQuizAttemptInput = z.infer<typeof createQuizAttemptSchema>;
export type AnswerQuizAttemptItemInput = z.infer<typeof answerQuizAttemptItemSchema>;
export type QuizAttempt = z.infer<typeof quizAttemptSchema>;
export type QuizAttemptAvailability = z.infer<typeof quizAttemptAvailabilitySchema>;
