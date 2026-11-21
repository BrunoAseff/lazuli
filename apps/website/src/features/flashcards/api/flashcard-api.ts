import {
  assetResponseSchema,
  type AssetResponse,
  type CreateFlashcardInput,
  type CreateFlashcardPracticeSessionInput,
  type FlashcardBatchInput,
  type FlashcardDetail,
  flashcardDetailSchema,
  type FlashcardListQuery,
  type FlashcardListResponse,
  flashcardListResponseSchema,
  type FlashcardImportPreview,
  flashcardImportPreviewSchema,
  type FlashcardPracticeAvailability,
  flashcardPracticeAvailabilitySchema,
  type FlashcardPracticeSession,
  flashcardPracticeSessionSchema,
  type SubmitFlashcardReviewInput,
  type ImportFlashcardsInput,
  type ImportFlashcardsResponse,
  importFlashcardsResponseSchema,
  type UpdateFlashcardInput,
} from "@lazuli/shared";

import { apiRequest } from "@/lib/api-client.ts";
import { buildSearchParams } from "@/lib/search-params.ts";

const collectionPath = (collectionId: string) =>
  `/api/flashcard-collections/${encodeURIComponent(collectionId)}`;

export const fetchFlashcards = (
  collectionId: string,
  input: FlashcardListQuery,
  signal?: AbortSignal,
): Promise<FlashcardListResponse> => {
  const params = buildSearchParams({
    filter: input.filter,
    page: input.page,
    pageSize: input.pageSize,
    query: input.query,
    sort: input.sort,
    status: input.status,
  });
  return apiRequest(
    `${collectionPath(collectionId)}/cards?${params}`,
    flashcardListResponseSchema,
    {
      signal,
    },
  );
};

export const fetchFlashcard = (
  collectionId: string,
  cardId: string,
  signal?: AbortSignal,
): Promise<FlashcardDetail> =>
  apiRequest(
    `${collectionPath(collectionId)}/cards/${encodeURIComponent(cardId)}`,
    flashcardDetailSchema,
    { signal },
  );

export const postFlashcard = (collectionId: string, input: CreateFlashcardInput) =>
  apiRequest(`${collectionPath(collectionId)}/cards`, flashcardDetailSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const patchFlashcard = (collectionId: string, cardId: string, input: UpdateFlashcardInput) =>
  apiRequest(
    `${collectionPath(collectionId)}/cards/${encodeURIComponent(cardId)}`,
    flashcardDetailSchema,
    { method: "PATCH", body: JSON.stringify(input) },
  );

export const removeFlashcard = (collectionId: string, cardId: string) =>
  apiRequest(`${collectionPath(collectionId)}/cards/${encodeURIComponent(cardId)}`, null, {
    method: "DELETE",
  });

export const postFlashcardBatch = (collectionId: string, input: FlashcardBatchInput) =>
  apiRequest(`${collectionPath(collectionId)}/cards/batch`, null, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const previewFlashcardImport = (
  collectionId: string,
  file: File,
): Promise<FlashcardImportPreview> => {
  const form = new FormData();
  form.set("file", file);
  return apiRequest(
    `${collectionPath(collectionId)}/cards/import/preview`,
    flashcardImportPreviewSchema,
    {
      method: "POST",
      body: form,
    },
  );
};

export const postFlashcardImport = (
  collectionId: string,
  input: ImportFlashcardsInput,
): Promise<ImportFlashcardsResponse> =>
  apiRequest(`${collectionPath(collectionId)}/cards/import`, importFlashcardsResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const uploadFlashcardImage = async (file: File): Promise<AssetResponse> => {
  const form = new FormData();
  form.set("file", file);
  return apiRequest("/api/flashcard-assets/images", assetResponseSchema, {
    method: "POST",
    body: form,
  });
};

/** What a practice runs over: one collection, or the flashcards of every collection in a project. */
export type PracticeTarget = { type: "collection" | "project"; id: string };

const practiceBase = (target: PracticeTarget) =>
  target.type === "collection"
    ? collectionPath(target.id)
    : `/api/projects/${encodeURIComponent(target.id)}`;

export const fetchPracticeAvailability = (
  target: PracticeTarget,
  signal?: AbortSignal,
): Promise<FlashcardPracticeAvailability> =>
  apiRequest(`${practiceBase(target)}/practice`, flashcardPracticeAvailabilitySchema, {
    signal,
  });

export const postPracticeSession = (
  target: PracticeTarget,
  input: CreateFlashcardPracticeSessionInput,
): Promise<FlashcardPracticeSession> =>
  apiRequest(`${practiceBase(target)}/practice-sessions`, flashcardPracticeSessionSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const fetchPracticeSession = (
  sessionId: string,
  signal?: AbortSignal,
): Promise<FlashcardPracticeSession> =>
  apiRequest(
    `/api/flashcard-practice-sessions/${encodeURIComponent(sessionId)}`,
    flashcardPracticeSessionSchema,
    { signal },
  );

export const postPracticeReview = (
  sessionId: string,
  input: SubmitFlashcardReviewInput,
): Promise<FlashcardPracticeSession> =>
  apiRequest(
    `/api/flashcard-practice-sessions/${encodeURIComponent(sessionId)}/reviews`,
    flashcardPracticeSessionSchema,
    { method: "POST", body: JSON.stringify(input) },
  );
