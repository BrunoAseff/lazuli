import { z } from "zod";

const generatedTextSchema = z.string().trim().min(1).max(4_000);
const sourceBlockIdsSchema = z.array(z.string().trim().min(1).max(128)).max(10);
const generatedReferencesSchema = z
  .array(
    z.object({
      blockId: z.string().trim().min(1).max(128),
      quote: z.string().trim().min(1).max(1_000),
    }),
  )
  .min(1)
  .max(3);

export const generatedFlashcardSchema = z.object({
  answer: generatedTextSchema,
  question: generatedTextSchema,
  sourceBlockIds: sourceBlockIdsSchema,
});

const generatedQuizQuestionObjectSchema = z.object({
  correctOptionIndex: z.number().int().min(0).max(5),
  options: z.array(generatedTextSchema.max(1_000)).min(4).max(6),
  prompt: generatedTextSchema,
  sourceBlockIds: sourceBlockIdsSchema,
});

const validateGeneratedQuizQuestion = (
  question: z.infer<typeof generatedQuizQuestionObjectSchema>,
  context: z.RefinementCtx,
) => {
  if (question.correctOptionIndex >= question.options.length)
    context.addIssue({
      code: "custom",
      message: "correctOptionIndex must reference an existing option",
      path: ["correctOptionIndex"],
    });
  const normalizedOptions = question.options.map((option) => option.toLocaleLowerCase());
  if (new Set(normalizedOptions).size !== normalizedOptions.length)
    context.addIssue({
      code: "custom",
      message: "quiz options must be unique",
      path: ["options"],
    });
};

export const generatedQuizQuestionSchema = generatedQuizQuestionObjectSchema.superRefine(
  validateGeneratedQuizQuestion,
);

const reviewedGeneratedQuizQuestionSchema = generatedQuizQuestionObjectSchema
  .extend({
    evidence: z.string().trim().min(1).max(1_000),
    references: generatedReferencesSchema,
    warning: z.string().trim().max(500).nullable(),
  })
  .superRefine(validateGeneratedQuizQuestion);

export const foundationDraftSchema = z.object({
  flashcards: z.array(generatedFlashcardSchema).length(1),
  quizQuestions: z.array(generatedQuizQuestionSchema).length(1),
});

export type FoundationDraft = z.infer<typeof foundationDraftSchema>;

export const countFoundationDraftItems = (draft: FoundationDraft) =>
  draft.flashcards.length + draft.quizQuestions.length;

export const selectionProviderDraftSchema = z
  .object({
    flashcards: z
      .array(
        generatedFlashcardSchema.extend({
          evidence: z.string().trim().min(1).max(1_000),
          references: generatedReferencesSchema,
          warning: z.string().trim().max(500).nullable(),
        }),
      )
      .max(5),
    quizQuestions: z.array(reviewedGeneratedQuizQuestionSchema).max(5),
  })
  .refine(
    ({ flashcards, quizQuestions }) => flashcards.length + quizQuestions.length > 0,
    "The generation must contain at least one material",
  );

export type SelectionProviderDraft = z.infer<typeof selectionProviderDraftSchema>;

export const collectionProviderDraftSchema = z
  .object({
    flashcards: z
      .array(
        generatedFlashcardSchema.extend({
          evidence: z.string().trim().min(1).max(1_000),
          references: generatedReferencesSchema,
          warning: z.string().trim().max(500).nullable(),
        }),
      )
      .max(10),
    quizQuestions: z.array(reviewedGeneratedQuizQuestionSchema).max(10),
  })
  .refine(
    ({ flashcards, quizQuestions }) => flashcards.length + quizQuestions.length > 0,
    "The generation must contain at least one material",
  );

const materialImprovementBaseSchema = z.object({
  warning: z.string().trim().max(500).nullable(),
});

export const flashcardImprovementProviderDraftSchema = materialImprovementBaseSchema.extend({
  question: generatedTextSchema,
  answer: generatedTextSchema,
});

export const quizImprovementProviderDraftSchema = materialImprovementBaseSchema
  .extend(generatedQuizQuestionObjectSchema.shape)
  .superRefine(validateGeneratedQuizQuestion);
