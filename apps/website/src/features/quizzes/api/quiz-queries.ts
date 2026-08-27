import type {
  CreateQuizAttemptInput,
  CreateQuizQuestionInput,
  QuizQuestionListQuery,
  UpdateQuizQuestionInput,
} from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { quizCollectionKeys } from "./quiz-collection-queries.ts";
import {
  fetchQuizAttempt,
  fetchQuizAttemptAvailability,
  fetchQuizQuestion,
  fetchQuizQuestions,
  patchQuizQuestion,
  postAbandonQuizAttempt,
  postCompleteQuizAttempt,
  postQuizAttempt,
  postQuizQuestion,
  putQuizAnswer,
  removeQuizQuestion,
} from "./quiz-api.ts";

export const quizKeys = {
  all: ["quizzes"] as const,
  questionLists: (collectionId: string) => [...quizKeys.all, collectionId, "questions"] as const,
  questionList: (collectionId: string, input: QuizQuestionListQuery) =>
    [...quizKeys.questionLists(collectionId), input] as const,
  question: (collectionId: string, questionId: string) =>
    [...quizKeys.all, collectionId, "question", questionId] as const,
  availability: (collectionId: string) => [...quizKeys.all, collectionId, "attempt"] as const,
  attempt: (attemptId: string) => [...quizKeys.all, "attempts", attemptId] as const,
};
export const useQuizQuestions = (collectionId: string, input: QuizQuestionListQuery) =>
  useQuery({
    queryKey: quizKeys.questionList(collectionId, input),
    queryFn: ({ signal }) => fetchQuizQuestions(collectionId, input, signal),
    enabled: Boolean(collectionId),
  });
export const useQuizQuestion = (collectionId: string, questionId: string | null) =>
  useQuery({
    queryKey: quizKeys.question(collectionId, questionId ?? ""),
    queryFn: ({ signal }) => fetchQuizQuestion(collectionId, questionId!, signal),
    enabled: Boolean(collectionId && questionId),
  });
const useInvalidateQuiz = (_collectionId: string) => {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: quizKeys.all }),
      client.invalidateQueries({ queryKey: quizCollectionKeys.all }),
    ]);
  };
};
export const useCreateQuizQuestion = (collectionId: string) => {
  const invalidate = useInvalidateQuiz(collectionId);
  return useMutation({
    mutationFn: (input: CreateQuizQuestionInput) => postQuizQuestion(collectionId, input),
    onSuccess: invalidate,
  });
};
export const useUpdateQuizQuestion = (collectionId: string, questionId: string) => {
  const invalidate = useInvalidateQuiz(collectionId);
  return useMutation({
    mutationFn: (input: UpdateQuizQuestionInput) =>
      patchQuizQuestion(collectionId, questionId, input),
    onSuccess: invalidate,
  });
};
export const usePatchQuizQuestion = (collectionId: string) => {
  const invalidate = useInvalidateQuiz(collectionId);
  return useMutation({
    mutationFn: ({ input, questionId }: { input: UpdateQuizQuestionInput; questionId: string }) =>
      patchQuizQuestion(collectionId, questionId, input),
    onSuccess: invalidate,
  });
};
export const useDeleteQuizQuestion = (collectionId: string) => {
  const invalidate = useInvalidateQuiz(collectionId);
  return useMutation({
    mutationFn: (questionId: string) => removeQuizQuestion(collectionId, questionId),
    onSuccess: invalidate,
  });
};
export const useQuizAttemptAvailability = (collectionId: string) =>
  useQuery({
    queryKey: quizKeys.availability(collectionId),
    queryFn: ({ signal }) => fetchQuizAttemptAvailability(collectionId, signal),
    enabled: Boolean(collectionId),
  });
export const useCreateQuizAttempt = (collectionId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuizAttemptInput) => postQuizAttempt(collectionId, input),
    onSuccess: (attempt) => {
      client.setQueryData(quizKeys.attempt(attempt.id), attempt);
      void client.invalidateQueries({ queryKey: quizKeys.availability(collectionId) });
    },
  });
};
export const useQuizAttempt = (attemptId: string) =>
  useQuery({
    queryKey: quizKeys.attempt(attemptId),
    queryFn: ({ signal }) => fetchQuizAttempt(attemptId, signal),
    enabled: Boolean(attemptId),
  });
export const useAnswerQuizAttempt = (attemptId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, optionId }: { itemId: string; optionId: string }) =>
      putQuizAnswer(attemptId, itemId, { optionId }),
    onSuccess: (attempt) => client.setQueryData(quizKeys.attempt(attemptId), attempt),
  });
};
export const useCompleteQuizAttempt = (attemptId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => postCompleteQuizAttempt(attemptId),
    onSuccess: (attempt) => {
      client.setQueryData(quizKeys.attempt(attemptId), attempt);
      void client.invalidateQueries({ queryKey: quizCollectionKeys.all });
    },
  });
};
export const useAbandonQuizAttempt = (attemptId: string) =>
  useMutation({ mutationFn: () => postAbandonQuizAttempt(attemptId) });
