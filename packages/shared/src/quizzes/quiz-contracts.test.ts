import { describe, expect, it } from "vitest";

import {
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
});
