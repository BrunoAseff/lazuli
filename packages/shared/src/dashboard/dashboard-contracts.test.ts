import { describe, expect, it } from "vitest";

import {
  dashboardResponseSchema,
  dismissDashboardOnboardingSchema,
} from "./dashboard-contracts.ts";

const ids = {
  collection: "1cbda44d-0388-44c0-a52e-1c29f99fc8c2",
  document: "2cbda44d-0388-44c0-a52e-1c29f99fc8c2",
  project: "3cbda44d-0388-44c0-a52e-1c29f99fc8c2",
};

const response = {
  reviewQueue: {
    totalDueReviews: 3,
    totalNewCards: 2,
    nextReviewAt: "2026-10-22T12:00:00.000Z",
    availableCollectionCount: 1,
    hiddenCollectionCount: 0,
    collections: [
      {
        collectionId: ids.collection,
        collectionTitle: "Anatomia",
        dueReviews: 3,
        newCards: 2,
        activeSession: null,
      },
    ],
  },
  onboarding: {
    visible: true,
    steps: [
      { id: "create-document", completed: true, href: "/documents" },
      { id: "generate-material", completed: false, href: "/documents/one/document/two" },
      { id: "set-goal", completed: false, href: "/stone?meta=editar" },
      { id: "practice-example", completed: false, href: "/flashcards" },
    ],
  },
  recentDocuments: [
    {
      documentId: ids.document,
      documentTitle: "Sistema nervoso",
      projectId: ids.project,
      projectTitle: "Anatomia",
      updatedAt: "2026-10-21T12:00:00.000Z",
    },
  ],
  quizContinuations: [],
};

describe("dashboard contracts", () => {
  it("accepts the bounded dashboard payload", () => {
    expect(dashboardResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects oversized document lists", () => {
    expect(
      dashboardResponseSchema.safeParse({
        ...response,
        recentDocuments: Array.from({ length: 5 }, () => response.recentDocuments[0]),
      }).success,
    ).toBe(false);
  });

  it("accepts only an explicit dismissal mutation", () => {
    expect(dismissDashboardOnboardingSchema.safeParse({ dismissed: true }).success).toBe(true);
    expect(dismissDashboardOnboardingSchema.safeParse({ dismissed: false }).success).toBe(false);
    expect(
      dismissDashboardOnboardingSchema.safeParse({ dismissed: true, userId: ids.project }).success,
    ).toBe(false);
  });
});
