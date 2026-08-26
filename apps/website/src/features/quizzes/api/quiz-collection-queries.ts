import type {
  CreateQuizCollectionInput,
  QuizCollectionListQuery,
  UpdateQuizCollectionInput,
} from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import {
  fetchQuizCollections,
  patchQuizCollection,
  postQuizCollection,
  removeQuizCollection,
} from "./quiz-collection-api.ts";

export const quizCollectionKeys = {
  all: QUERY_KEY_ROOTS.quizCollections,
  lists: () => [...quizCollectionKeys.all, "list"] as const,
  list: (input: QuizCollectionListQuery) => [...quizCollectionKeys.lists(), input] as const,
};

export const useQuizCollections = (input: QuizCollectionListQuery) =>
  useQuery({
    queryKey: quizCollectionKeys.list(input),
    queryFn: ({ signal }) => fetchQuizCollections(input, signal),
  });

const useInvalidateCollections = () => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: quizCollectionKeys.lists() });
};

export const useCreateQuizCollection = () => {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (input: CreateQuizCollectionInput) => postQuizCollection(input),
    onSuccess: invalidate,
  });
};

export const useUpdateQuizCollection = (collectionId: string) => {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (input: UpdateQuizCollectionInput) => patchQuizCollection(collectionId, input),
    onSuccess: invalidate,
  });
};

export const useRestoreQuizCollection = () => {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (collectionId: string) => patchQuizCollection(collectionId, { archived: false }),
    onSuccess: invalidate,
  });
};

export const useDeleteQuizCollection = (collectionId: string) => {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: () => removeQuizCollection(collectionId),
    onSuccess: invalidate,
  });
};
