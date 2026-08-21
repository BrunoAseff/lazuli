import { describe, expect, it } from "vitest";

import {
  createFlashcardCollectionSchema,
  flashcardCollectionListQuerySchema,
  flashcardCollectionSummarySchema,
  updateFlashcardCollectionSchema,
} from "./flashcard-contracts.ts";

describe("flashcard collection contracts", () => {
  it("normalizes titles and defaults a collection to no project", () => {
    expect(
      createFlashcardCollectionSchema.parse({
        id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
        title: "  Anatomia   humana ",
      }),
    ).toEqual({
      id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
      title: "Anatomia humana",
      projectId: null,
    });
  });

  it("parses the supported project and status filters", () => {
    expect(flashcardCollectionListQuerySchema.parse({ project: "none" })).toMatchObject({
      page: 1,
      pageSize: 12,
      project: "none",
      status: "active",
    });
  });

  it("rejects an update without a change", () => {
    expect(updateFlashcardCollectionSchema.safeParse({}).success).toBe(false);
  });

  it("rejects inconsistent metrics", () => {
    const result = flashcardCollectionSummarySchema.safeParse({
      id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
      title: "Anatomia",
      project: null,
      archivedAt: null,
      totalCards: 1,
      studiedCards: 2,
      dueCards: 0,
      nextPracticeAt: null,
      reviewsLastSevenDays: 0,
      lastReviewedAt: null,
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});
