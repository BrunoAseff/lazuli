import { z } from "zod";

const generatedTextSchema = z.string().trim().min(1).max(4_000);
const sourceBlockIdsSchema = z.array(z.string().trim().min(1).max(128)).max(10);

export const generatedFlashcardSchema = z.object({
  answer: generatedTextSchema,
  question: generatedTextSchema,
  sourceBlockIds: sourceBlockIdsSchema,
});

export const generatedQuizQuestionSchema = z
  .object({
    correctOptionIndex: z.number().int().min(0).max(5),
    options: z.array(generatedTextSchema.max(1_000)).min(2).max(6),
    prompt: generatedTextSchema,
    sourceBlockIds: sourceBlockIdsSchema,
  })
  .superRefine((question, context) => {
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
  });

export const foundationDraftSchema = z.object({
  flashcards: z.array(generatedFlashcardSchema).length(1),
  quizQuestions: z.array(generatedQuizQuestionSchema).length(1),
});

export type FoundationDraft = z.infer<typeof foundationDraftSchema>;

export const countFoundationDraftItems = (draft: FoundationDraft) =>
  draft.flashcards.length + draft.quizQuestions.length;
