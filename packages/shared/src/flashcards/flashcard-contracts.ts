import { z } from "zod";

import { documentContentSchema } from "../documents/document-contracts.ts";
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

export const FLASHCARD_COLLECTION_PAGE_SIZE = STUDY_COLLECTION_PAGE_SIZE;
export const FLASHCARD_COLLECTION_MAX_PAGE_SIZE = STUDY_COLLECTION_MAX_PAGE_SIZE;
export const FLASHCARD_PAGE_SIZE = 25;
export const FLASHCARD_MAX_PAGE_SIZE = 100;
export const FLASHCARD_MAX_CONTENT_BYTES = 256 * 1024;
export const FLASHCARD_BATCH_MAX_SIZE = 100;
export const FLASHCARD_PRACTICE_MAX_SIZE = 200;
export const FLASHCARD_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const FLASHCARD_IMPORT_MAX_ROWS = 1_000;
export const FLASHCARD_IMPORT_TEXT_MAX_LENGTH = 10_000;

export const flashcardCollectionIdSchema = studyCollectionIdSchema;
export const flashcardCollectionTitleSchema = studyCollectionTitleSchema;
export const flashcardCollectionStatusSchema = studyCollectionStatusSchema;
export const flashcardCollectionProjectFilterSchema = studyCollectionProjectFilterSchema;
export const flashcardRatingSchema = z.enum(["again", "hard", "good", "easy"]);
export const flashcardIdSchema = z.uuid();
export const flashcardPracticeSessionIdSchema = z.uuid();
export const flashcardStatusSchema = z.enum(["active", "archived"]);
export const flashcardScheduleFilterSchema = z.enum(["all", "new", "due", "scheduled"]);
export const flashcardSortSchema = z.enum(["updated", "created", "due"]);
export const flashcardSrsStateSchema = z.enum(["new", "learning", "review", "relearning"]);
export const flashcardPracticeStatusSchema = z.enum(["active", "completed", "abandoned"]);

const hasMeaningfulContent = (blocks: z.infer<typeof documentContentSchema>) => {
  const pending = [...blocks];
  while (pending.length) {
    const block = pending.pop()!;
    if (block.type === "image") return true;
    if (
      block.content?.some((item) =>
        item.type === "text"
          ? Boolean(item.text.trim())
          : item.content.some(({ text }) => Boolean(text.trim())),
      )
    )
      return true;
    if (block.children) pending.push(...block.children);
  }
  return false;
};

const utf8ByteLength = (value: string) => {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
};

export const flashcardContentSchema = documentContentSchema.superRefine((content, context) => {
  if (utf8ByteLength(JSON.stringify(content)) > FLASHCARD_MAX_CONTENT_BYTES)
    context.addIssue({ code: "custom", message: "O conteúdo deve ter no máximo 256 KB." });
  if (!hasMeaningfulContent(content))
    context.addIssue({ code: "custom", message: "Informe um conteúdo para o flashcard." });
});

export const flashcardListQuerySchema = z.object({
  query: z.string().trim().max(200).default(""),
  status: flashcardStatusSchema.default("active"),
  filter: flashcardScheduleFilterSchema.default("all"),
  sort: flashcardSortSchema.default("updated"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(FLASHCARD_MAX_PAGE_SIZE)
    .default(FLASHCARD_PAGE_SIZE),
});

export const createFlashcardSchema = z.object({
  id: flashcardIdSchema,
  question: flashcardContentSchema,
  answer: flashcardContentSchema,
});

export const updateFlashcardSchema = z
  .object({
    question: flashcardContentSchema.optional(),
    answer: flashcardContentSchema.optional(),
    collectionId: flashcardCollectionIdSchema.optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    ({ answer, archived, collectionId, question }) =>
      answer !== undefined ||
      archived !== undefined ||
      collectionId !== undefined ||
      question !== undefined,
    { message: "Informe ao menos uma alteração." },
  );

export const flashcardBatchSchema = z.object({
  ids: z
    .array(flashcardIdSchema)
    .min(1)
    .max(FLASHCARD_BATCH_MAX_SIZE)
    .refine((ids) => new Set(ids).size === ids.length),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("archive") }),
    z.object({ type: z.literal("restore") }),
    z.object({ type: z.literal("move"), collectionId: flashcardCollectionIdSchema }),
    z.object({ type: z.literal("delete") }),
  ]),
});

export const flashcardSummarySchema = z.object({
  id: flashcardIdSchema,
  collectionId: flashcardCollectionIdSchema,
  questionText: z.string(),
  answerText: z.string(),
  questionHasImage: z.boolean(),
  answerHasImage: z.boolean(),
  srsState: flashcardSrsStateSchema,
  dueAt: z.iso.datetime(),
  lastReviewedAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const flashcardImportRowSchema = z.object({
  question: z.string().trim().min(1).max(FLASHCARD_IMPORT_TEXT_MAX_LENGTH),
  answer: z.string().trim().min(1).max(FLASHCARD_IMPORT_TEXT_MAX_LENGTH),
});

export const flashcardImportPreviewSchema = z.object({
  format: z.enum(["csv", "tsv", "txt"]),
  rows: z.array(flashcardImportRowSchema).max(FLASHCARD_IMPORT_MAX_ROWS),
  skippedRows: z.number().int().nonnegative(),
});

export const importFlashcardsSchema = z.object({
  cards: z
    .array(flashcardImportRowSchema.extend({ id: flashcardIdSchema }))
    .min(1)
    .max(FLASHCARD_IMPORT_MAX_ROWS)
    .refine((cards) => new Set(cards.map(({ id }) => id)).size === cards.length),
});

export const importFlashcardsResponseSchema = z.object({ imported: z.number().int().positive() });

export const flashcardDetailSchema = flashcardSummarySchema.extend({
  question: flashcardContentSchema,
  answer: flashcardContentSchema,
  contentSchemaVersion: z.number().int().positive(),
});

export const createFlashcardPracticeSessionSchema = z
  .object({
    id: z.uuid(),
    size: z.union([
      z.literal(10),
      z.literal(20),
      z.literal(50),
      z.literal(FLASHCARD_PRACTICE_MAX_SIZE),
    ]),
    abandonActive: z.boolean().default(false),
  })
  .strict();

export const submitFlashcardReviewSchema = z
  .object({ id: z.uuid(), itemId: z.uuid(), rating: flashcardRatingSchema })
  .strict();

export const flashcardRatingCountsSchema = z.object({
  again: z.number().int().nonnegative(),
  hard: z.number().int().nonnegative(),
  good: z.number().int().nonnegative(),
  easy: z.number().int().nonnegative(),
});

export const flashcardIntervalPreviewSchema = z.object({
  rating: flashcardRatingSchema,
  dueAt: z.iso.datetime(),
  intervalSeconds: z.number().int().nonnegative(),
});

export const flashcardPracticeItemSchema = z.object({
  id: z.uuid(),
  position: z.number().int().nonnegative(),
  card: flashcardDetailSchema,
  intervals: z.array(flashcardIntervalPreviewSchema).length(4),
});

export const flashcardPracticeSessionSchema = z.object({
  id: z.uuid(),
  collectionId: flashcardCollectionIdSchema,
  collectionTitle: z.string(),
  status: flashcardPracticeStatusSchema,
  totalCards: z.number().int().nonnegative(),
  reviewedCards: z.number().int().nonnegative(),
  startedAt: z.iso.datetime(),
  lastActivityAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  currentItem: flashcardPracticeItemSchema.nullable(),
  reviewedMaterials: z.array(
    z.object({
      id: flashcardIdSchema,
      questionText: z.string(),
      referenceCount: z.number().int().nonnegative(),
    }),
  ),
  ratings: flashcardRatingCountsSchema,
});

export const flashcardPracticeAvailabilitySchema = z.object({
  activeSession: flashcardPracticeSessionSchema.nullable(),
  archived: z.boolean(),
  newCards: z.number().int().nonnegative(),
  dueCards: z.number().int().nonnegative(),
  totalAvailable: z.number().int().nonnegative(),
});

export const flashcardListResponseSchema = z.object({
  items: z.array(flashcardSummarySchema),
  pagination: paginationSchema,
});

export const flashcardCollectionListQuerySchema = z.object(studyCollectionListQueryShape).strict();

export const createFlashcardCollectionSchema = createStudyCollectionSchema;

export const updateFlashcardCollectionSchema = updateStudyCollectionSchema;

const flashcardMetricSchema = z.number().int().nonnegative();
export const flashcardCollectionSummarySchema = z
  .object({
    id: flashcardCollectionIdSchema,
    title: z.string(),
    project: z
      .object({
        id: projectIdSchema,
        title: z.string(),
      })
      .nullable(),
    archivedAt: z.iso.datetime().nullable(),
    totalCards: flashcardMetricSchema,
    newCards: flashcardMetricSchema,
    studiedCards: flashcardMetricSchema,
    dueCards: flashcardMetricSchema,
    nextPracticeAt: z.iso.datetime().nullable(),
    reviewsLastSevenDays: flashcardMetricSchema,
    successRateLastSevenDays: z.number().min(0).max(1).nullable(),
    lastReviewedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine(({ dueCards, newCards, studiedCards, totalCards }, context) => {
    if (studiedCards > totalCards)
      context.addIssue({ code: "custom", message: "A contagem de cards estudados é inválida." });
    if (dueCards > totalCards)
      context.addIssue({ code: "custom", message: "A contagem de cards disponíveis é inválida." });
    if (newCards > totalCards)
      context.addIssue({ code: "custom", message: "A contagem de cards novos é inválida." });
  });

export const flashcardCollectionListResponseSchema = z.object({
  items: z.array(flashcardCollectionSummarySchema),
  pagination: paginationSchema,
});

export type FlashcardCollectionListQuery = z.infer<typeof flashcardCollectionListQuerySchema>;
export type FlashcardCollectionStatus = z.infer<typeof flashcardCollectionStatusSchema>;
export type CreateFlashcardCollectionInput = z.infer<typeof createFlashcardCollectionSchema>;
export type UpdateFlashcardCollectionInput = z.infer<typeof updateFlashcardCollectionSchema>;
export type FlashcardCollectionSummary = z.infer<typeof flashcardCollectionSummarySchema>;
export type FlashcardCollectionListResponse = z.infer<typeof flashcardCollectionListResponseSchema>;
export type FlashcardRating = z.infer<typeof flashcardRatingSchema>;
export type FlashcardListQuery = z.infer<typeof flashcardListQuerySchema>;
export type FlashcardSummary = z.infer<typeof flashcardSummarySchema>;
export type FlashcardDetail = z.infer<typeof flashcardDetailSchema>;
export type FlashcardListResponse = z.infer<typeof flashcardListResponseSchema>;
export type FlashcardImportPreview = z.infer<typeof flashcardImportPreviewSchema>;
export type ImportFlashcardsInput = z.infer<typeof importFlashcardsSchema>;
export type ImportFlashcardsResponse = z.infer<typeof importFlashcardsResponseSchema>;
export type CreateFlashcardInput = z.infer<typeof createFlashcardSchema>;
export type UpdateFlashcardInput = z.infer<typeof updateFlashcardSchema>;
export type FlashcardBatchInput = z.infer<typeof flashcardBatchSchema>;
export type FlashcardSrsState = z.infer<typeof flashcardSrsStateSchema>;
export type FlashcardPracticeStatus = z.infer<typeof flashcardPracticeStatusSchema>;
export type CreateFlashcardPracticeSessionInput = z.infer<
  typeof createFlashcardPracticeSessionSchema
>;
export type SubmitFlashcardReviewInput = z.infer<typeof submitFlashcardReviewSchema>;
export type FlashcardPracticeSession = z.infer<typeof flashcardPracticeSessionSchema>;
export type FlashcardPracticeAvailability = z.infer<typeof flashcardPracticeAvailabilitySchema>;
