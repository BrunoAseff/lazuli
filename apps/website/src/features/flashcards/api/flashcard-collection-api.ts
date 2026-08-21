import {
  flashcardCollectionListResponseSchema,
  flashcardCollectionSummarySchema,
  type CreateFlashcardCollectionInput,
  type FlashcardCollectionListQuery,
  type FlashcardCollectionListResponse,
  type FlashcardCollectionSummary,
  type UpdateFlashcardCollectionInput,
} from "@lazuli/shared";

import { ApiError, apiRequest as request } from "@/lib/api-client.ts";

export { ApiError as FlashcardCollectionApiError };

const toSearchParams = ({
  page,
  pageSize,
  project,
  query,
  status,
}: FlashcardCollectionListQuery) => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    status,
  });
  if (query) params.set("query", query);
  if (project) params.set("project", project);
  return params;
};

export const fetchFlashcardCollections = (
  input: FlashcardCollectionListQuery,
  signal?: AbortSignal,
): Promise<FlashcardCollectionListResponse> =>
  request(
    `/api/flashcard-collections?${toSearchParams(input)}`,
    flashcardCollectionListResponseSchema,
    { signal },
  );

export const postFlashcardCollection = (
  input: CreateFlashcardCollectionInput,
): Promise<FlashcardCollectionSummary> =>
  request("/api/flashcard-collections", flashcardCollectionSummarySchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const patchFlashcardCollection = (
  collectionId: string,
  input: UpdateFlashcardCollectionInput,
): Promise<FlashcardCollectionSummary> =>
  request(
    `/api/flashcard-collections/${encodeURIComponent(collectionId)}`,
    flashcardCollectionSummarySchema,
    { method: "PATCH", body: JSON.stringify(input) },
  );

export const removeFlashcardCollection = (collectionId: string): Promise<void> =>
  request(`/api/flashcard-collections/${encodeURIComponent(collectionId)}`, null, {
    method: "DELETE",
  });
