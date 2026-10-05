import { z } from "zod";

import { documentContentSchema } from "../documents/document-contracts.ts";
import { flashcardContentSchema } from "../flashcards/flashcard-contracts.ts";
import { quizOptionInputSchema, quizQuestionContentSchema } from "../quizzes/quiz-contracts.ts";
import { studyCollectionIdSchema } from "../study-collections/study-collection-contracts.ts";

export const AI_SELECTION_MIN_TEXT_LENGTH = 20;
export const AI_SELECTION_MAX_TEXT_LENGTH = 12_000;
export const AI_SELECTION_MAX_BLOCKS = 20;
export const AI_DOCUMENT_MAX_BLOCKS = 400;
export const AI_DOCUMENT_MAX_TEXT_LENGTH = 80_000;
export const AI_SELECTION_MAX_ITEMS = 5;
export const AI_COLLECTION_MAX_ITEMS = 10;
export const AI_CREDITS_PER_ITEM = 10;
export const AI_MAX_REFERENCES_PER_ITEM = 3;

export const aiMaterialKindSchema = z.enum(["flashcard", "quizQuestion"]);
export const aiGenerationIdSchema = z.uuid();

const selectionSourceBlockIdsSchema = z
  .array(z.string().trim().min(1).max(128))
  .min(1)
  .max(AI_SELECTION_MAX_BLOCKS)
  .refine((ids) => new Set(ids).size === ids.length, "Os blocos da fonte devem ser únicos.");

const generationRequestBaseSchema = z.object({
  idempotencyKey: z.uuid(),
  documentId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  kind: aiMaterialKindSchema,
  collectionId: studyCollectionIdSchema,
  quantity: z.number().int().min(1).max(AI_SELECTION_MAX_ITEMS),
  guidance: z.string().trim().max(500).default(""),
  regenerateOperationId: aiGenerationIdSchema.optional(),
});

export const createAiSelectionGenerationSchema = z.discriminatedUnion("sourceScope", [
  generationRequestBaseSchema
    .extend({
      sourceScope: z.literal("image"),
      anchorId: z.string().trim().min(1).max(128),
      selectedText: z.literal(""),
      sourceBlockIds: z.array(z.string().trim().min(1).max(128)).length(1),
    })
    .strict(),
  generationRequestBaseSchema
    .extend({
      sourceScope: z.literal("selection"),
      anchorId: z.string().trim().min(1).max(128),
      selectedText: z
        .string()
        .trim()
        .min(AI_SELECTION_MIN_TEXT_LENGTH, "Selecione um trecho um pouco maior.")
        .max(AI_SELECTION_MAX_TEXT_LENGTH, "O trecho selecionado é muito grande."),
      sourceBlockIds: selectionSourceBlockIdsSchema,
    })
    .strict(),
  generationRequestBaseSchema
    .extend({
      sourceScope: z.literal("document"),
      anchorId: z.null(),
      selectedText: z.literal(""),
      sourceBlockIds: z.array(z.never()).length(0),
    })
    .strict(),
]);

const generatedTextSchema = z.string().trim().min(1).max(4_000);

export const aiReferenceProposalSchema = z
  .object({
    scope: z.enum(["selection", "document"]).default("selection"),
    blockId: z.string().trim().max(128).nullable().default(null),
    quote: z.string().trim().max(1_000).default(""),
  })
  .superRefine((reference, context) => {
    if (reference.scope !== "selection") return;
    if (!reference.blockId)
      context.addIssue({ code: "custom", path: ["blockId"], message: "Informe o bloco." });
    if (!reference.quote)
      context.addIssue({ code: "custom", path: ["quote"], message: "Informe o trecho." });
  });

const proposalReferencesSchema = z
  .array(aiReferenceProposalSchema)
  .max(AI_MAX_REFERENCES_PER_ITEM)
  .default([]);

export const aiFlashcardProposalSchema = z.object({
  id: z.uuid(),
  question: generatedTextSchema,
  answer: generatedTextSchema,
  evidence: generatedTextSchema.max(1_000),
  references: proposalReferencesSchema,
  referenceWarning: z.string().trim().max(500).nullable().default(null),
  warning: z.string().trim().max(500).nullable(),
});

export const aiQuizProposalSchema = z
  .object({
    id: z.uuid(),
    prompt: generatedTextSchema,
    // Drafts remain compatible with previously generated and manually edited
    // questions. Provider output is validated separately and must contain 4–6.
    options: z.array(generatedTextSchema.max(1_000)).min(2).max(6),
    correctOptionIndex: z.number().int().min(0).max(5),
    evidence: generatedTextSchema.max(1_000),
    references: proposalReferencesSchema,
    referenceWarning: z.string().trim().max(500).nullable().default(null),
    warning: z.string().trim().max(500).nullable(),
  })
  .superRefine((question, context) => {
    if (question.correctOptionIndex >= question.options.length)
      context.addIssue({
        code: "custom",
        path: ["correctOptionIndex"],
        message: "A resposta correta deve apontar para uma alternativa existente.",
      });
    const normalized = question.options.map((option) => option.toLocaleLowerCase("pt-BR"));
    if (new Set(normalized).size !== normalized.length)
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "As alternativas devem ser diferentes.",
      });
  });

export const aiSelectionDraftSchema = z.object({
  operationId: aiGenerationIdSchema,
  kind: aiMaterialKindSchema,
  collectionId: studyCollectionIdSchema,
  documentId: z.uuid(),
  projectId: z.uuid().nullable().default(null),
  projectTitle: z.string().trim().max(100).default("Projeto"),
  documentTitle: z.string().trim().max(100).default("Documento"),
  documentRevision: z.number().int().nonnegative(),
  sourceScope: z.enum(["selection", "image", "document"]).default("selection"),
  anchorId: z.string().min(1).max(128).nullable(),
  sourceBlockIds: z.array(z.string().trim().min(1).max(128)).max(AI_DOCUMENT_MAX_BLOCKS),
  sourceText: z.string().max(AI_DOCUMENT_MAX_TEXT_LENGTH),
  requestedItems: z.number().int().min(1).max(AI_SELECTION_MAX_ITEMS),
  consumedCredits: z.number().int().nonnegative(),
  regenerationCount: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime(),
  approved: z.boolean(),
  flashcards: z.array(aiFlashcardProposalSchema).max(AI_SELECTION_MAX_ITEMS),
  quizQuestions: z.array(aiQuizProposalSchema).max(AI_SELECTION_MAX_ITEMS),
});

export const createAiCollectionGenerationSchema = z
  .object({
    idempotencyKey: z.uuid(),
    documentId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    kind: aiMaterialKindSchema,
    collectionId: studyCollectionIdSchema,
    quantity: z.number().int().min(1).max(AI_COLLECTION_MAX_ITEMS),
    guidance: z.string().trim().max(500).default(""),
    sourceBlockIds: z
      .array(z.string().trim().min(1).max(128))
      .max(AI_DOCUMENT_MAX_BLOCKS)
      .default([]),
  })
  .strict();

export const aiCollectionDraftSchema = aiSelectionDraftSchema.extend({
  requestedItems: z.number().int().min(1).max(AI_COLLECTION_MAX_ITEMS),
  sourceScope: z.enum(["document", "section"]),
  flashcards: z.array(aiFlashcardProposalSchema).max(AI_COLLECTION_MAX_ITEMS),
  quizQuestions: z.array(aiQuizProposalSchema).max(AI_COLLECTION_MAX_ITEMS),
});

export const aiCollectionGenerationResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("none") }),
  z.object({ status: z.enum(["queued", "processing"]), operationId: aiGenerationIdSchema }),
  z.object({ status: z.literal("completed"), draft: aiCollectionDraftSchema }),
]);

export const aiSelectionGenerationResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("running"), operationId: aiGenerationIdSchema }),
  z.object({ status: z.literal("completed"), draft: aiSelectionDraftSchema }),
]);

const approvedFlashcardSchema = z.object({
  id: z.uuid(),
  question: flashcardContentSchema,
  answer: flashcardContentSchema,
  references: proposalReferencesSchema,
});

const approvedQuizSchema = z
  .object({
    id: z.uuid(),
    content: quizQuestionContentSchema,
    options: z.array(quizOptionInputSchema).min(2).max(6),
    references: proposalReferencesSchema,
  })
  .superRefine(({ options }, context) => {
    if (options.filter(({ isCorrect }) => isCorrect).length !== 1)
      context.addIssue({
        code: "custom",
        message: "A questão deve possuir exatamente uma resposta correta.",
        path: ["options"],
      });
    const normalized = options.map(({ text }) => text.trim().toLocaleLowerCase("pt-BR"));
    if (new Set(normalized).size !== normalized.length)
      context.addIssue({
        code: "custom",
        message: "As alternativas devem ser diferentes.",
        path: ["options"],
      });
  });

export const approveAiSelectionGenerationSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    anchoredContent: documentContentSchema.optional(),
    flashcards: z.array(approvedFlashcardSchema).max(AI_COLLECTION_MAX_ITEMS).default([]),
    quizQuestions: z.array(approvedQuizSchema).max(AI_COLLECTION_MAX_ITEMS).default([]),
  })
  .strict()
  .refine(({ flashcards, quizQuestions }) => flashcards.length + quizQuestions.length > 0, {
    message: "Aprove ao menos um material.",
  });

export const approveAiSelectionGenerationResponseSchema = z.object({
  createdIds: z.array(z.uuid()),
  revision: z.number().int().nonnegative(),
});

export type AiMaterialKind = z.infer<typeof aiMaterialKindSchema>;
export type CreateAiSelectionGenerationInput = z.infer<typeof createAiSelectionGenerationSchema>;
export type AiSelectionDraft = z.infer<typeof aiSelectionDraftSchema>;
export type CreateAiCollectionGenerationInput = z.infer<typeof createAiCollectionGenerationSchema>;
export type AiCollectionDraft = z.infer<typeof aiCollectionDraftSchema>;
export type ApproveAiSelectionGenerationInput = z.infer<typeof approveAiSelectionGenerationSchema>;
