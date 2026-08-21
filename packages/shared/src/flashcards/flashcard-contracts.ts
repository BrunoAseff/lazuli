import { z } from "zod";

import { paginationSchema, projectIdSchema } from "../projects/project-contracts.ts";

export const FLASHCARD_COLLECTION_PAGE_SIZE = 12;
export const FLASHCARD_COLLECTION_MAX_PAGE_SIZE = 24;

export const flashcardCollectionIdSchema = z.uuid();
export const flashcardCollectionTitleSchema = z
  .string()
  .trim()
  .min(1, "Informe o título da coleção.")
  .max(100, "O título deve ter no máximo 100 caracteres.")
  .transform((title) => title.replace(/\s+/g, " "));
export const flashcardCollectionStatusSchema = z.enum(["active", "archived"]);
export const flashcardCollectionProjectFilterSchema = z.union([projectIdSchema, z.literal("none")]);
export const flashcardRatingSchema = z.enum(["again", "hard", "good", "easy"]);

export const flashcardCollectionListQuerySchema = z.object({
  query: z.string().trim().max(100).default(""),
  project: flashcardCollectionProjectFilterSchema.optional(),
  status: flashcardCollectionStatusSchema.default("active"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(FLASHCARD_COLLECTION_MAX_PAGE_SIZE)
    .default(FLASHCARD_COLLECTION_PAGE_SIZE),
});

export const createFlashcardCollectionSchema = z.object({
  id: flashcardCollectionIdSchema,
  title: flashcardCollectionTitleSchema,
  projectId: projectIdSchema.nullable().default(null),
});

export const updateFlashcardCollectionSchema = z
  .object({
    title: flashcardCollectionTitleSchema.optional(),
    projectId: projectIdSchema.nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    ({ archived, projectId, title }) =>
      archived !== undefined || projectId !== undefined || title !== undefined,
    { message: "Informe ao menos uma alteração." },
  );

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
    studiedCards: flashcardMetricSchema,
    dueCards: flashcardMetricSchema,
    nextPracticeAt: z.iso.datetime().nullable(),
    reviewsLastSevenDays: flashcardMetricSchema,
    lastReviewedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine(({ dueCards, studiedCards, totalCards }, context) => {
    if (studiedCards > totalCards)
      context.addIssue({ code: "custom", message: "A contagem de cards estudados é inválida." });
    if (dueCards > totalCards)
      context.addIssue({ code: "custom", message: "A contagem de cards disponíveis é inválida." });
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
