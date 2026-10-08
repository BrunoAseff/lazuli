import { describe, expect, it } from "vitest";

import {
  AI_SELECTION_MAX_ITEMS,
  AI_SELECTION_MAX_TEXT_LENGTH,
  aiReferenceProposalSchema,
  aiQuizProposalSchema,
  approveAiSelectionGenerationSchema,
  createAiSelectionGenerationSchema,
} from "./ai-contracts.ts";

const paragraph = (id: string, text: string) => [
  { id, type: "paragraph", content: [{ type: "text", text, styles: {} }] },
];

describe("AI selection contracts", () => {
  it("accepts a reference quote up to the supported selection size", () => {
    expect(
      aiReferenceProposalSchema.safeParse({
        blockId: "source-1",
        quote: "x".repeat(AI_SELECTION_MAX_TEXT_LENGTH),
        scope: "selection",
      }).success,
    ).toBe(true);
  });

  it("keeps persisted two-option drafts readable after provider rules become stricter", () => {
    expect(
      aiQuizProposalSchema.safeParse({
        correctOptionIndex: 0,
        evidence: "Trecho usado para produzir a questão.",
        id: "44444444-4444-4444-8444-444444444444",
        options: ["Correta", "Incorreta"],
        prompt: "Qual alternativa está correta?",
        warning: null,
      }).success,
    ).toBe(true);
  });

  it("limits generation volume and source size at the shared boundary", () => {
    const result = createAiSelectionGenerationSchema.safeParse({
      anchorId: "anchor-1",
      collectionId: "11111111-1111-4111-8111-111111111111",
      documentId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 1,
      guidance: "",
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      kind: "flashcard",
      quantity: AI_SELECTION_MAX_ITEMS + 1,
      selectedPreview: "Trecho suficientemente longo para geração.",
      selectedText: "Trecho suficientemente longo para geração.",
      sourceScope: "selection",
      sourceBlockIds: ["block-1"],
    });

    expect(result.success).toBe(false);
  });

  it("accepts only a server-resolved image block as an image source", () => {
    const result = createAiSelectionGenerationSchema.safeParse({
      anchorId: "image-block-1",
      collectionId: "11111111-1111-4111-8111-111111111111",
      documentId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 1,
      guidance: "",
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      kind: "flashcard",
      quantity: 1,
      selectedText: "",
      sourceScope: "image",
      sourceBlockIds: ["image-block-1"],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a document source without client-provided document content", () => {
    const result = createAiSelectionGenerationSchema.safeParse({
      anchorId: null,
      collectionId: "11111111-1111-4111-8111-111111111111",
      documentId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 1,
      guidance: "",
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      kind: "quizQuestion",
      quantity: 3,
      selectedText: "",
      sourceScope: "document",
      sourceBlockIds: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects edited quiz proposals with duplicate or ambiguous answers", () => {
    const result = approveAiSelectionGenerationSchema.safeParse({
      anchoredContent: paragraph("source-1", "Trecho suficientemente longo para geração."),
      expectedRevision: 1,
      flashcards: [],
      quizQuestions: [
        {
          content: paragraph("question-1", "Qual alternativa está correta?"),
          id: "44444444-4444-4444-8444-444444444444",
          options: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              isCorrect: true,
              text: "Mesma resposta",
            },
            {
              id: "66666666-6666-4666-8666-666666666666",
              isCorrect: true,
              text: " mesma resposta ",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map(({ message }) => message)).toEqual(
        expect.arrayContaining([
          "A questão deve possuir exatamente uma resposta correta.",
          "As alternativas devem ser diferentes.",
        ]),
      );
  });

  it("limits references submitted for one approved material", () => {
    const result = approveAiSelectionGenerationSchema.safeParse({
      anchoredContent: paragraph("source-1", "Trecho suficientemente longo para geração."),
      expectedRevision: 1,
      flashcards: [
        {
          answer: paragraph("answer-1", "Resposta"),
          id: "44444444-4444-4444-8444-444444444444",
          question: paragraph("question-1", "Pergunta?"),
          references: Array.from({ length: 4 }, (_, index) => ({
            blockId: `source-${index}`,
            quote: `Trecho ${index}`,
          })),
        },
      ],
      quizQuestions: [],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a whole-document reference without a synthetic quote", () => {
    const result = approveAiSelectionGenerationSchema.safeParse({
      expectedRevision: 1,
      flashcards: [
        {
          answer: paragraph("answer-1", "Resposta"),
          id: "44444444-4444-4444-8444-444444444444",
          question: paragraph("question-1", "Pergunta?"),
          references: [{ scope: "document", blockId: null, quote: "" }],
        },
      ],
      quizQuestions: [],
    });

    expect(result.success).toBe(true);
  });
});
