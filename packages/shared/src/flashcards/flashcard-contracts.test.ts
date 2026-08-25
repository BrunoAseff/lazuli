import { describe, expect, it } from "vitest";

import {
  createFlashcardCollectionSchema,
  createFlashcardPracticeSessionSchema,
  createFlashcardSchema,
  flashcardBatchSchema,
  flashcardCollectionListQuerySchema,
  flashcardCollectionSummarySchema,
  submitFlashcardReviewSchema,
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

  it("requires meaningful rich content on both sides", () => {
    const empty = [{ id: "empty", type: "paragraph", content: [] }];
    const text = [
      {
        id: "question",
        type: "paragraph",
        content: [{ type: "text", text: "O que é FSRS?", styles: {} }],
      },
    ];
    expect(
      createFlashcardSchema.safeParse({
        id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
        question: text,
        answer: empty,
      }).success,
    ).toBe(false);
    expect(
      createFlashcardSchema.safeParse({
        id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
        question: text,
        answer: text,
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate ids in a batch", () => {
    const id = "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62";
    expect(
      flashcardBatchSchema.safeParse({ ids: [id, id], action: { type: "archive" } }).success,
    ).toBe(false);
  });

  it("caps practice choices and rejects calculated review fields", () => {
    const id = "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62";
    expect(createFlashcardPracticeSessionSchema.parse({ id, size: 200 })).toEqual({
      id,
      size: 200,
      abandonActive: false,
    });
    expect(createFlashcardPracticeSessionSchema.safeParse({ id, size: 201 }).success).toBe(false);
    expect(
      submitFlashcardReviewSchema.safeParse({
        id,
        itemId: "7412788b-ef4b-4bbd-8cab-493d32738867",
        rating: "good",
        dueAt: "2099-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
