import type {
  CreateFlashcardInput,
  CreateFlashcardPracticeSessionInput,
  FlashcardBatchInput,
  FlashcardListQuery,
  SubmitFlashcardReviewInput,
  UpdateFlashcardInput,
} from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { flashcardCollectionKeys } from "./flashcard-collection-queries.ts";
import {
  fetchFlashcard,
  fetchFlashcardCollection,
  fetchFlashcards,
  fetchPracticeAvailability,
  fetchPracticeSession,
  patchFlashcard,
  postAbandonPracticeSession,
  postFlashcard,
  postFlashcardBatch,
  postFlashcardImport,
  postPracticeReview,
  postPracticeSession,
  previewFlashcardImport,
  removeFlashcard,
} from "./flashcard-api.ts";

export const flashcardKeys = {
  all: QUERY_KEY_ROOTS.flashcards,
  collection: (collectionId: string) => [...flashcardKeys.all, "collection", collectionId] as const,
  lists: (collectionId: string) => [...flashcardKeys.collection(collectionId), "list"] as const,
  list: (collectionId: string, input: FlashcardListQuery) =>
    [...flashcardKeys.lists(collectionId), input] as const,
  detail: (collectionId: string, cardId: string) =>
    [...flashcardKeys.collection(collectionId), "detail", cardId] as const,
  availability: (collectionId: string) =>
    [...flashcardKeys.collection(collectionId), "practice-availability"] as const,
  practiceSession: (sessionId: string) => [...flashcardKeys.all, "practice", sessionId] as const,
};

export const usePracticeAvailability = (collectionId: string, enabled = true) =>
  useQuery({
    enabled,
    queryKey: flashcardKeys.availability(collectionId),
    queryFn: ({ signal }) => fetchPracticeAvailability(collectionId, signal),
  });

export const usePracticeSession = (sessionId: string) =>
  useQuery({
    queryKey: flashcardKeys.practiceSession(sessionId),
    queryFn: ({ signal }) => fetchPracticeSession(sessionId, signal),
  });

export const useCreatePracticeSession = (collectionId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFlashcardPracticeSessionInput) =>
      postPracticeSession(collectionId, input),
    onSuccess: (session) => {
      client.setQueryData(flashcardKeys.practiceSession(session.id), session);
      return client.invalidateQueries({ queryKey: flashcardKeys.availability(collectionId) });
    },
  });
};

export const useSubmitPracticeReview = (sessionId: string, collectionId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitFlashcardReviewInput) => postPracticeReview(sessionId, input),
    onSuccess: async (session) => {
      client.setQueryData(flashcardKeys.practiceSession(sessionId), session);
      if (session.status === "completed")
        await Promise.all([
          client.invalidateQueries({ queryKey: flashcardKeys.collection(collectionId) }),
          client.invalidateQueries({ queryKey: flashcardKeys.availability(collectionId) }),
          client.invalidateQueries({ queryKey: flashcardCollectionKeys.lists() }),
        ]);
    },
  });
};

export const useAbandonPracticeSession = (collectionId: string, sessionId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => postAbandonPracticeSession(sessionId),
    onSuccess: async () => {
      client.removeQueries({ queryKey: flashcardKeys.practiceSession(sessionId) });
      await Promise.all([
        client.invalidateQueries({ queryKey: flashcardKeys.availability(collectionId) }),
        client.invalidateQueries({ queryKey: flashcardKeys.collection(collectionId) }),
        client.invalidateQueries({ queryKey: flashcardCollectionKeys.lists() }),
      ]);
    },
  });
};

export const useFlashcardCollection = (collectionId: string) =>
  useQuery({
    queryKey: flashcardKeys.collection(collectionId),
    queryFn: ({ signal }) => fetchFlashcardCollection(collectionId, signal),
  });

export const useFlashcards = (collectionId: string, input: FlashcardListQuery) =>
  useQuery({
    queryKey: flashcardKeys.list(collectionId, input),
    queryFn: ({ signal }) => fetchFlashcards(collectionId, input, signal),
  });

export const useFlashcard = (collectionId: string, cardId: string | null) =>
  useQuery({
    enabled: Boolean(cardId),
    queryKey: flashcardKeys.detail(collectionId, cardId ?? ""),
    queryFn: ({ signal }) => fetchFlashcard(collectionId, cardId!, signal),
  });

const useInvalidateFlashcards = (collectionId: string) => {
  const client = useQueryClient();
  return async (otherCollectionId?: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: flashcardKeys.collection(collectionId) }),
      client.invalidateQueries({ queryKey: flashcardCollectionKeys.lists() }),
      otherCollectionId && otherCollectionId !== collectionId
        ? client.invalidateQueries({ queryKey: flashcardKeys.collection(otherCollectionId) })
        : Promise.resolve(),
    ]);
  };
};

export const useCreateFlashcard = (collectionId: string) => {
  const invalidate = useInvalidateFlashcards(collectionId);
  return useMutation({
    mutationFn: (input: CreateFlashcardInput) => postFlashcard(collectionId, input),
    onSuccess: () => invalidate(),
  });
};

export const usePreviewFlashcardImport = (collectionId: string) =>
  useMutation({ mutationFn: (file: File) => previewFlashcardImport(collectionId, file) });

export const useImportFlashcards = (collectionId: string) => {
  const invalidate = useInvalidateFlashcards(collectionId);
  return useMutation({
    mutationFn: postFlashcardImport.bind(null, collectionId),
    onSuccess: () => invalidate(),
  });
};

export const useUpdateFlashcard = (collectionId: string, cardId: string) => {
  const invalidate = useInvalidateFlashcards(collectionId);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFlashcardInput) => patchFlashcard(collectionId, cardId, input),
    onSuccess: async (card) => {
      client.setQueryData(flashcardKeys.detail(card.collectionId, card.id), card);
      await invalidate(card.collectionId);
    },
  });
};

export const useDeleteFlashcard = (collectionId: string) => {
  const invalidate = useInvalidateFlashcards(collectionId);
  return useMutation({
    mutationFn: (cardId: string) => removeFlashcard(collectionId, cardId),
    onSuccess: () => invalidate(),
  });
};

export const useBatchFlashcards = (collectionId: string) => {
  const invalidate = useInvalidateFlashcards(collectionId);
  return useMutation({
    mutationFn: (input: FlashcardBatchInput) => postFlashcardBatch(collectionId, input),
    onSuccess: (_result, input) =>
      invalidate(input.action.type === "move" ? input.action.collectionId : undefined),
  });
};
