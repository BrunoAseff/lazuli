import { describe, expect, it } from "vitest";

import { buildReviewQueue, selectDashboardContent } from "./dashboard-queries.ts";

const ids = {
  collection: "1cbda44d-0388-44c0-a52e-1c29f99fc8c2",
  secondCollection: "2cbda44d-0388-44c0-a52e-1c29f99fc8c2",
  session: "3cbda44d-0388-44c0-a52e-1c29f99fc8c2",
  attempt: "4cbda44d-0388-44c0-a52e-1c29f99fc8c2",
};

const base = {
  activeQuizAttempts: [],
  quizCandidates: [],
  recentDocuments: [],
};

describe("dashboard query decisions", () => {
  it("separates reviews from new cards and keeps active sessions first", () => {
    const result = buildReviewQueue({
      activeSessions: [
        {
          collectionId: ids.collection,
          collectionTitle: "Memória",
          sessionId: ids.session,
          reviewedCards: 2,
          totalCards: 5,
        },
      ],
      collections: [
        {
          collectionId: ids.collection,
          collectionTitle: "Memória",
          dueReviews: 3,
          newCards: 1,
        },
        {
          collectionId: ids.secondCollection,
          collectionTitle: "Outra",
          dueReviews: 2,
          newCards: 4,
        },
      ],
      totals: {
        availableCollectionCount: 2,
        nextReviewAt: new Date("2026-10-23T12:00:00.000Z"),
        totalDueReviews: 5,
        totalNewCards: 5,
      },
    });

    expect(result).toMatchObject({
      totalDueReviews: 5,
      totalNewCards: 5,
      nextReviewAt: "2026-10-23T12:00:00.000Z",
      hiddenCollectionCount: 0,
    });
    expect(result.collections[0]).toEqual({
      collectionId: ids.collection,
      collectionTitle: "Memória",
      dueReviews: 3,
      newCards: 1,
      activeSession: { sessionId: ids.session, reviewedCards: 2, totalCards: 5 },
    });
  });

  it("keeps active and candidate quizzes in the continuation list", () => {
    const result = selectDashboardContent({
      ...base,
      activeQuizAttempts: [
        {
          attemptId: ids.attempt,
          collectionId: ids.collection,
          collectionTitle: "Quiz",
          answeredQuestions: 1,
          totalQuestions: 4,
        },
      ],
      quizCandidates: [
        {
          collectionId: ids.secondCollection,
          collectionTitle: "Outro quiz",
          lastAttemptAt: null,
          totalQuestions: 3,
        },
      ],
    });
    expect(result.quizContinuations).toEqual([
      {
        kind: "active",
        attemptId: ids.attempt,
        collectionId: ids.collection,
        collectionTitle: "Quiz",
        answeredQuestions: 1,
        totalQuestions: 4,
      },
      {
        kind: "untried",
        collectionId: ids.secondCollection,
        collectionTitle: "Outro quiz",
        lastAttemptAt: null,
        totalQuestions: 3,
      },
    ]);
  });
});
