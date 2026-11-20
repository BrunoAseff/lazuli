import type {
  CreateQuizAttemptInput,
  CreateQuizQuestionInput,
  QuizAttempt,
  QuizQuestionListQuery,
  UpdateQuizQuestionInput,
} from "@lazuli/shared";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";

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
      client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.studyMetrics }),
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
  const client = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => removeQuizQuestion(collectionId, questionId),
    onSuccess: (_result, questionId) => {
      client.removeQueries({ queryKey: quizKeys.question(collectionId, questionId) });
      return invalidate();
    },
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
/** The attempt with one item's choice set (or cleared), and the answered count recomputed. */
export const withQuizChoice = (
  attempt: QuizAttempt,
  itemId: string,
  optionId: string | null,
): QuizAttempt => {
  if (attempt.status !== "active") return attempt;
  const items = attempt.items.map((item) =>
    item.id === itemId ? { ...item, selectedOptionId: optionId } : item,
  );
  return {
    ...attempt,
    items,
    answeredQuestions: items.filter(({ selectedOptionId }) => Boolean(selectedOptionId)).length,
  };
};

/** Answers and the completion of one attempt share a queue, so they reach the server in order. */
const attemptQueue = (attemptId: string) => ({ id: `quiz-attempt:${attemptId}` });

/**
 * Choosing an alternative shows at once: the cache takes the choice before the server answers.
 * A failure undoes only that choice, and only if no later choice replaced it; the attempt is then
 * read again. Only the last answer to settle writes the server's copy, and never over a finished
 * attempt, so a quick change of mind never flickers and finishing never goes back.
 */
export const answerQuizMutation = (client: QueryClient, attemptId: string) => {
  const key = quizKeys.attempt(attemptId);
  const mutationKey = ["quiz-answer", attemptId];
  const lastOne = () => client.isMutating({ mutationKey }) <= 1;
  const finished = () => client.getQueryData<QuizAttempt>(key)?.status === "completed";
  return {
    mutationKey,
    scope: attemptQueue(attemptId),
    mutationFn: ({ itemId, optionId }: { itemId: string; optionId: string }) =>
      putQuizAnswer(attemptId, itemId, { optionId }),
    onMutate: async ({ itemId, optionId }: { itemId: string; optionId: string }) => {
      await client.cancelQueries({ queryKey: key });
      const current = client.getQueryData<QuizAttempt>(key);
      const before =
        current?.status === "active"
          ? (current.items.find(({ id }) => id === itemId)?.selectedOptionId ?? null)
          : null;
      if (current) client.setQueryData<QuizAttempt>(key, withQuizChoice(current, itemId, optionId));
      return { before };
    },
    onError: (
      _error: unknown,
      { itemId, optionId }: { itemId: string; optionId: string },
      context: { before: string | null } | undefined,
    ) => {
      if (finished()) return;
      client.setQueryData<QuizAttempt>(key, (current) => {
        if (!current || current.status !== "active") return current;
        const now = current.items.find(({ id }) => id === itemId)?.selectedOptionId ?? null;
        return now === optionId
          ? withQuizChoice(current, itemId, context?.before ?? null)
          : current;
      });
      if (lastOne()) void client.invalidateQueries({ queryKey: key });
    },
    onSuccess: (attempt: QuizAttempt) => {
      if (!finished() && lastOne()) client.setQueryData(key, attempt);
    },
  };
};
export const useAnswerQuizAttempt = (attemptId: string) => {
  const client = useQueryClient();
  return useMutation(answerQuizMutation(client, attemptId));
};
export const completeQuizMutation = (client: QueryClient, attemptId: string) => ({
  // Waits for any answer still on its way: the last choice is always in before finishing.
  scope: attemptQueue(attemptId),
  mutationFn: () => postCompleteQuizAttempt(attemptId),
  onSuccess: (attempt: QuizAttempt) => {
    client.setQueryData(quizKeys.attempt(attemptId), attempt);
    void client.invalidateQueries({ queryKey: quizCollectionKeys.all });
    void client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.studyMetrics });
  },
});
export const useCompleteQuizAttempt = (attemptId: string) => {
  const client = useQueryClient();
  return useMutation(completeQuizMutation(client, attemptId));
};
export const useAbandonQuizAttempt = (attemptId: string) =>
  useMutation({ mutationFn: () => postAbandonQuizAttempt(attemptId) });
