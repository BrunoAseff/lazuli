import {
  flashcardCollectionListResponseSchema,
  flashcardCollectionSummarySchema,
  type CreateFlashcardCollectionInput,
  type FlashcardCollectionListQuery,
  type FlashcardCollectionListResponse,
  type FlashcardCollectionSummary,
  type UpdateFlashcardCollectionInput,
} from "@lazuli/shared";

import { ApiError } from "@/lib/api-client.ts";
import { createStudyCollectionApi } from "@/lib/study-collection-api.ts";

export { ApiError as FlashcardCollectionApiError };

const api = createStudyCollectionApi<
  FlashcardCollectionSummary,
  FlashcardCollectionListResponse,
  CreateFlashcardCollectionInput,
  UpdateFlashcardCollectionInput,
  FlashcardCollectionListQuery
>({
  collectionSchema: flashcardCollectionSummarySchema,
  listSchema: flashcardCollectionListResponseSchema,
  path: "/api/flashcard-collections",
});

export const fetchFlashcardCollection = api.fetchCollection;
export const fetchFlashcardCollections = api.fetchCollections;
export const patchFlashcardCollection = api.patchCollection;
export const postFlashcardCollection = api.postCollection;
export const removeFlashcardCollection = api.removeCollection;
