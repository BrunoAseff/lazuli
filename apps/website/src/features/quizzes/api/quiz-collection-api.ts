import {
  quizCollectionListResponseSchema,
  quizCollectionSummarySchema,
  type CreateQuizCollectionInput,
  type QuizCollectionListQuery,
  type QuizCollectionListResponse,
  type QuizCollectionSummary,
  type UpdateQuizCollectionInput,
} from "@lazuli/shared";

import { createStudyCollectionApi } from "@/lib/study-collection-api.ts";

const api = createStudyCollectionApi<
  QuizCollectionSummary,
  QuizCollectionListResponse,
  CreateQuizCollectionInput,
  UpdateQuizCollectionInput,
  QuizCollectionListQuery
>({
  collectionSchema: quizCollectionSummarySchema,
  listSchema: quizCollectionListResponseSchema,
  path: "/api/quiz-collections",
});

export const fetchQuizCollection = api.fetchCollection;
export const fetchQuizCollections = api.fetchCollections;
export const patchQuizCollection = api.patchCollection;
export const postQuizCollection = api.postCollection;
export const removeQuizCollection = api.removeCollection;
