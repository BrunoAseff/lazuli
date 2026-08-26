import {
  assetResponseSchema,
  type AnswerQuizAttemptItemInput,
  type AssetResponse,
  type CreateQuizAttemptInput,
  type CreateQuizQuestionInput,
  type QuizAttempt,
  type QuizAttemptAvailability,
  quizAttemptAvailabilitySchema,
  quizAttemptSchema,
  type QuizQuestionDetail,
  quizQuestionDetailSchema,
  type QuizQuestionListQuery,
  type QuizQuestionListResponse,
  quizQuestionListResponseSchema,
  type UpdateQuizQuestionInput,
} from "@lazuli/shared";

import { apiRequest } from "@/lib/api-client.ts";

const collectionPath = (collectionId: string) =>
  `/api/quiz-collections/${encodeURIComponent(collectionId)}`;
export const fetchQuizQuestions = (
  collectionId: string,
  input: QuizQuestionListQuery,
  signal?: AbortSignal,
): Promise<QuizQuestionListResponse> => {
  const params = new URLSearchParams({
    query: input.query,
    status: input.status,
    sort: input.sort,
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  return apiRequest(
    `${collectionPath(collectionId)}/questions?${params}`,
    quizQuestionListResponseSchema,
    { signal },
  );
};
export const fetchQuizQuestion = (
  collectionId: string,
  questionId: string,
  signal?: AbortSignal,
): Promise<QuizQuestionDetail> =>
  apiRequest(
    `${collectionPath(collectionId)}/questions/${encodeURIComponent(questionId)}`,
    quizQuestionDetailSchema,
    { signal },
  );
export const postQuizQuestion = (collectionId: string, input: CreateQuizQuestionInput) =>
  apiRequest(`${collectionPath(collectionId)}/questions`, quizQuestionDetailSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
export const patchQuizQuestion = (
  collectionId: string,
  questionId: string,
  input: UpdateQuizQuestionInput,
) =>
  apiRequest(
    `${collectionPath(collectionId)}/questions/${encodeURIComponent(questionId)}`,
    quizQuestionDetailSchema,
    { method: "PATCH", body: JSON.stringify(input) },
  );
export const removeQuizQuestion = (collectionId: string, questionId: string) =>
  apiRequest(`${collectionPath(collectionId)}/questions/${encodeURIComponent(questionId)}`, null, {
    method: "DELETE",
  });
export const uploadQuizImage = async (file: File): Promise<AssetResponse> => {
  const form = new FormData();
  form.set("file", file);
  return apiRequest("/api/quiz-assets/images", assetResponseSchema, { method: "POST", body: form });
};
export const fetchQuizAttemptAvailability = (
  collectionId: string,
  signal?: AbortSignal,
): Promise<QuizAttemptAvailability> =>
  apiRequest(`${collectionPath(collectionId)}/attempt`, quizAttemptAvailabilitySchema, { signal });
export const postQuizAttempt = (
  collectionId: string,
  input: CreateQuizAttemptInput,
): Promise<QuizAttempt> =>
  apiRequest(`${collectionPath(collectionId)}/attempts`, quizAttemptSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
export const fetchQuizAttempt = (attemptId: string, signal?: AbortSignal): Promise<QuizAttempt> =>
  apiRequest(`/api/quiz-attempts/${encodeURIComponent(attemptId)}`, quizAttemptSchema, { signal });
export const putQuizAnswer = (
  attemptId: string,
  itemId: string,
  input: AnswerQuizAttemptItemInput,
): Promise<QuizAttempt> =>
  apiRequest(
    `/api/quiz-attempts/${encodeURIComponent(attemptId)}/items/${encodeURIComponent(itemId)}/answer`,
    quizAttemptSchema,
    { method: "PUT", body: JSON.stringify(input) },
  );
export const postCompleteQuizAttempt = (attemptId: string): Promise<QuizAttempt> =>
  apiRequest(`/api/quiz-attempts/${encodeURIComponent(attemptId)}/complete`, quizAttemptSchema, {
    method: "POST",
    body: JSON.stringify({}),
  });
export const postAbandonQuizAttempt = (attemptId: string) =>
  apiRequest(`/api/quiz-attempts/${encodeURIComponent(attemptId)}/abandon`, null, {
    method: "POST",
    body: JSON.stringify({}),
  });
