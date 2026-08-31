import { z } from "zod";

import { projectItemIdSchema } from "../documents/document-contracts.ts";
import { sourceAnchorIdSchema } from "../documents/source-anchor.ts";
import { flashcardIdSchema } from "../flashcards/flashcard-contracts.ts";
import { projectIdSchema } from "../projects/project-contracts.ts";
import { quizQuestionIdSchema } from "../quizzes/quiz-contracts.ts";

export const REFERENCE_PAGE_SIZE = 20;
export const REFERENCE_MAX_PAGE_SIZE = 100;
export const REFERENCE_MAX_PER_TARGET = 20;
export const REFERENCE_MAX_BATCH_SIZE = 25;

export const referenceIdSchema = z.uuid();
export const referenceTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("flashcard"), id: flashcardIdSchema }),
  z.object({ type: z.literal("quizQuestion"), id: quizQuestionIdSchema }),
]);
export const referenceSourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("document"), documentId: projectItemIdSchema }),
  z.object({
    type: z.literal("selection"),
    documentId: projectItemIdSchema,
    anchorId: sourceAnchorIdSchema,
  }),
]);
export const createReferencesSchema = z
  .object({
    source: referenceSourceSchema,
    targets: z
      .array(referenceTargetSchema)
      .min(1)
      .max(REFERENCE_MAX_BATCH_SIZE)
      .refine(
        (targets) =>
          new Set(targets.map(({ id, type }) => `${type}:${id}`)).size === targets.length,
      ),
  })
  .strict();

export const referenceListQuerySchema = z
  .object({
    targetType: z.enum(["flashcard", "quizQuestion"]).optional(),
    targetId: z.uuid().optional(),
    documentId: projectItemIdSchema.optional(),
    anchorId: sourceAnchorIdSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(REFERENCE_MAX_PAGE_SIZE)
      .default(REFERENCE_PAGE_SIZE),
  })
  .strict()
  .superRefine(({ anchorId, documentId, targetId, targetType }, context) => {
    if (Boolean(targetId) !== Boolean(targetType))
      context.addIssue({ code: "custom", message: "Informe um destino completo." });
    if (anchorId && !documentId)
      context.addIssue({ code: "custom", message: "Informe o documento da referência." });
    if (!targetId && !documentId)
      context.addIssue({ code: "custom", message: "Informe a origem ou o destino." });
  });

const referenceMaterialSchema = z.object({
  type: z.enum(["flashcard", "quizQuestion"]),
  id: z.uuid(),
  collectionId: z.uuid(),
  collectionTitle: z.string(),
  preview: z.string(),
  archived: z.boolean(),
});
export const studyMaterialReferenceSchema = z.object({
  id: referenceIdSchema,
  projectId: projectIdSchema,
  projectTitle: z.string(),
  documentId: projectItemIdSchema,
  documentTitle: z.string(),
  anchorId: sourceAnchorIdSchema.nullable(),
  sourcePreview: z.string().nullable(),
  material: referenceMaterialSchema,
  createdAt: z.iso.datetime(),
});
export const referenceListResponseSchema = z.object({
  items: z.array(studyMaterialReferenceSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export const createReferencesResponseSchema = z.object({
  created: z.number().int().nonnegative(),
  items: z.array(studyMaterialReferenceSchema),
});

export type ReferenceTarget = z.infer<typeof referenceTargetSchema>;
export type ReferenceSource = z.infer<typeof referenceSourceSchema>;
export type CreateReferencesInput = z.infer<typeof createReferencesSchema>;
export type ReferenceListQuery = z.infer<typeof referenceListQuerySchema>;
export type StudyMaterialReference = z.infer<typeof studyMaterialReferenceSchema>;
export type ReferenceListResponse = z.infer<typeof referenceListResponseSchema>;
export type CreateReferencesResponse = z.infer<typeof createReferencesResponseSchema>;
