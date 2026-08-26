import {
  quizCollectionListResponseSchema,
  quizCollectionSummarySchema,
  type CreateQuizCollectionInput,
  type QuizCollectionListQuery,
  type QuizCollectionListResponse,
  type QuizCollectionSummary,
  type UpdateQuizCollectionInput,
} from "@lazuli/shared";

import { apiRequest as request } from "@/lib/api-client.ts";

const toSearchParams = ({ page, pageSize, project, query, status }: QuizCollectionListQuery) => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    status,
  });
  if (query) params.set("query", query);
  if (project) params.set("project", project);
  return params;
};

export const fetchQuizCollections = (
  input: QuizCollectionListQuery,
  signal?: AbortSignal,
): Promise<QuizCollectionListResponse> =>
  request(`/api/quiz-collections?${toSearchParams(input)}`, quizCollectionListResponseSchema, {
    signal,
  });

export const postQuizCollection = (
  input: CreateQuizCollectionInput,
): Promise<QuizCollectionSummary> =>
  request("/api/quiz-collections", quizCollectionSummarySchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const patchQuizCollection = (
  collectionId: string,
  input: UpdateQuizCollectionInput,
): Promise<QuizCollectionSummary> =>
  request(
    `/api/quiz-collections/${encodeURIComponent(collectionId)}`,
    quizCollectionSummarySchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

export const removeQuizCollection = (collectionId: string): Promise<void> =>
  request(`/api/quiz-collections/${encodeURIComponent(collectionId)}`, null, {
    method: "DELETE",
  });
