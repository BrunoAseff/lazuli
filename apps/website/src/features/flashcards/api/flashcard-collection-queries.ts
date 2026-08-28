import type {
  CreateFlashcardCollectionInput,
  FlashcardCollectionListQuery,
  UpdateFlashcardCollectionInput,
} from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import {
  fetchFlashcardCollections,
  patchFlashcardCollection,
  postFlashcardCollection,
  removeFlashcardCollection,
} from "./flashcard-collection-api.ts";

export const flashcardCollectionKeys = {
  all: QUERY_KEY_ROOTS.flashcardCollections,
  lists: () => [...flashcardCollectionKeys.all, "list"] as const,
  list: (input: FlashcardCollectionListQuery) =>
    [...flashcardCollectionKeys.lists(), input] as const,
};

export const useFlashcardCollections = (input: FlashcardCollectionListQuery, enabled = true) =>
  useQuery({
    enabled,
    queryKey: flashcardCollectionKeys.list(input),
    queryFn: ({ signal }) => fetchFlashcardCollections(input, signal),
  });

const useInvalidateCollections = () => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: flashcardCollectionKeys.lists() });
};

export const useCreateFlashcardCollection = () => {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (input: CreateFlashcardCollectionInput) => postFlashcardCollection(input),
    onSuccess: invalidate,
  });
};

export const useUpdateFlashcardCollection = (collectionId: string) => {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (input: UpdateFlashcardCollectionInput) =>
      patchFlashcardCollection(collectionId, input),
    onSuccess: invalidate,
  });
};

export const useRestoreFlashcardCollection = () => {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (collectionId: string) =>
      patchFlashcardCollection(collectionId, { archived: false }),
    onSuccess: invalidate,
  });
};

export const useDeleteFlashcardCollection = (collectionId: string) => {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: () => removeFlashcardCollection(collectionId),
    onSuccess: invalidate,
  });
};
