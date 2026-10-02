import { describe, expect, it } from "vitest";

import { foundationDraftSchema } from "./ai-schemas.ts";

describe("AI structured output schema", () => {
  it("accepts one flashcard and one valid multiple-choice question", () => {
    expect(
      foundationDraftSchema.safeParse({
        flashcards: [{ answer: "Resposta", question: "Pergunta?", sourceBlockIds: ["block-1"] }],
        quizQuestions: [
          {
            correctOptionIndex: 0,
            options: ["Correta", "Incorreta A", "Incorreta B", "Incorreta C"],
            prompt: "Qual é correta?",
            sourceBlockIds: ["block-1"],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects duplicated alternatives and an invalid correct answer index", () => {
    const result = foundationDraftSchema.safeParse({
      flashcards: [{ answer: "Resposta", question: "Pergunta?", sourceBlockIds: [] }],
      quizQuestions: [
        {
          correctOptionIndex: 2,
          options: ["Igual", "igual"],
          prompt: "Pergunta?",
          sourceBlockIds: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
