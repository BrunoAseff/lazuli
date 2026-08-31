import { describe, expect, it } from "vitest";

import {
  activeQuizAttemptSchema,
  createQuizQuestionSchema,
  createQuizCollectionSchema,
  quizCollectionListQuerySchema,
  quizCollectionSummarySchema,
  updateQuizCollectionSchema,
} from "./quiz-contracts.ts";

const id = "1cbda44d-0388-44c0-a52e-1c29f99fc8c2";

describe("quiz collection contracts", () => {
  it("normalizes collection input and rejects unknown fields", () => {
    expect(
      createQuizCollectionSchema.parse({ id, projectId: null, title: "  História   geral  " }),
    ).toEqual({ id, projectId: null, title: "História geral" });
    expect(
      createQuizCollectionSchema.safeParse({ id, projectId: null, title: "História", userId: id })
        .success,
    ).toBe(false);
  });

  it("limits list input and requires an actual update", () => {
    expect(quizCollectionListQuerySchema.safeParse({ pageSize: 25 }).success).toBe(false);
    expect(updateQuizCollectionSchema.safeParse({}).success).toBe(false);
    expect(updateQuizCollectionSchema.safeParse({ archived: true }).success).toBe(true);
  });

  it("distinguishes no attempt from a zero score and validates score bounds", () => {
    const base = {
      id,
      title: "História",
      project: null,
      archivedAt: null,
      totalQuestions: 4,
      totalAttempts: 0,
      attemptsLastSevenDays: 0,
      bestScoreRate: null,
      lastAttemptAt: null,
      createdAt: "2026-08-25T12:00:00.000Z",
      updatedAt: "2026-08-25T12:00:00.000Z",
    };
    expect(quizCollectionSummarySchema.parse({ ...base, lastScore: null }).lastScore).toBeNull();
    expect(
      quizCollectionSummarySchema.safeParse({
        ...base,
        lastScore: { correctAnswers: 5, totalQuestions: 4, rate: 1 },
      }).success,
    ).toBe(false);
  });

  it("requires two to six distinct alternatives and exactly one correct answer", () => {
    const content = [
      {
        id: "question",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "Qual é a resposta?", styles: {} }],
        children: [],
      },
    ];
    const optionA = "2cbda44d-0388-44c0-a52e-1c29f99fc8c2";
    const optionB = "3cbda44d-0388-44c0-a52e-1c29f99fc8c2";
    expect(
      createQuizQuestionSchema.safeParse({
        id,
        content,
        options: [
          { id: optionA, text: "A", isCorrect: true },
          { id: optionB, text: "B", isCorrect: false },
        ],
      }).success,
    ).toBe(true);
    expect(
      createQuizQuestionSchema.safeParse({
        id,
        content,
        options: [
          { id: optionA, text: "Igual", isCorrect: true },
          { id: optionB, text: " igual ", isCorrect: true },
        ],
      }).success,
    ).toBe(false);
  });

  it("strips correction fields from an active attempt payload", () => {
    const parsed = activeQuizAttemptSchema.parse({
      id,
      collectionId: "4cbda44d-0388-44c0-a52e-1c29f99fc8c2",
      collectionTitle: "História",
      status: "active",
      totalQuestions: 1,
      answeredQuestions: 0,
      correctAnswers: 0,
      startedAt: "2026-08-25T12:00:00.000Z",
      lastActivityAt: "2026-08-25T12:00:00.000Z",
      completedAt: null,
      items: [
        {
          id: "5cbda44d-0388-44c0-a52e-1c29f99fc8c2",
          questionId: "8cbda44d-0388-44c0-a52e-1c29f99fc8c2",
          referenceCount: 0,
          position: 0,
          question: [
            {
              id: "question",
              type: "paragraph",
              props: {},
              content: [{ type: "text", text: "Pergunta", styles: {} }],
              children: [],
            },
          ],
          options: [
            { id: "6cbda44d-0388-44c0-a52e-1c29f99fc8c2", text: "A", position: 0 },
            { id: "7cbda44d-0388-44c0-a52e-1c29f99fc8c2", text: "B", position: 1 },
          ],
          selectedOptionId: null,
          answeredAt: null,
          correctOptionId: "6cbda44d-0388-44c0-a52e-1c29f99fc8c2",
        },
      ],
    });
    expect(parsed.items[0]).not.toHaveProperty("correctOptionId");
  });
});
