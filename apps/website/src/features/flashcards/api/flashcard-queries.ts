import type {
  CreateFlashcardInput,
  CreateFlashcardPracticeSessionInput,
  FlashcardBatchInput,
  FlashcardListQuery,
  SubmitFlashcardReviewInput,
  UpdateFlashcardInput,
} from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { flashcardCollectionKeys } from "./flashcard-collection-queries.ts";
import {
  fetchFlashcard,
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
  type PracticeTarget,
} from "./flashcard-api.ts";
import { fetchFlashcardCollection } from "./flashcard-collection-api.ts";

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
  practiceAvailability: (target: PracticeTarget) =>
    target.type === "collection"
      ? flashcardKeys.availability(target.id)
      : ([...flashcardKeys.all, "project", target.id, "practice-availability"] as const),
  practiceSession: (sessionId: string) => [...flashcardKeys.all, "practice", sessionId] as const,
};

export type { PracticeTarget };

/** Where a practice opens, and where it returns to. */
export const practicePaths = (target: PracticeTarget) =>
  target.type === "collection"
    ? {
        home: `/flashcards/${target.id}`,
        session: (sessionId: string) => `/flashcards/${target.id}/practice/${sessionId}`,
      }
    : {
        home: `/documents/${target.id}`,
        session: (sessionId: string) => `/documents/${target.id}/practice/${sessionId}`,
      };

export const usePracticeAvailability = (target: PracticeTarget, enabled = true) =>
  useQuery({
    enabled,
    queryKey: flashcardKeys.practiceAvailability(target),
    queryFn: ({ signal }) => fetchPracticeAvailability(target, signal),
  });

export const usePracticeSession = (sessionId: string) =>
  useQuery({
    queryKey: flashcardKeys.practiceSession(sessionId),
    queryFn: ({ signal }) => fetchPracticeSession(sessionId, signal),
  });

/** After a session ends, what it touched: its collection, or every collection of its project. */
const refreshAfterPractice = (client: ReturnType<typeof useQueryClient>, target: PracticeTarget) =>
  Promise.all([
    client.invalidateQueries({ queryKey: flashcardKeys.practiceAvailability(target) }),
    client.invalidateQueries({
      queryKey:
        target.type === "collection" ? flashcardKeys.collection(target.id) : flashcardKeys.all,
    }),
    client.invalidateQueries({ queryKey: flashcardCollectionKeys.lists() }),
  ]);

export const useCreatePracticeSession = (target: PracticeTarget) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFlashcardPracticeSessionInput) => postPracticeSession(target, input),
    onSuccess: (session) => {
      client.setQueryData(flashcardKeys.practiceSession(session.id), session);
      return client.invalidateQueries({ queryKey: flashcardKeys.practiceAvailability(target) });
    },
  });
};

export const useSubmitPracticeReview = (sessionId: string, target: PracticeTarget) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitFlashcardReviewInput) => postPracticeReview(sessionId, input),
    onSuccess: async (session) => {
      void client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.studyMetrics });
      client.setQueryData(flashcardKeys.practiceSession(sessionId), session);
      if (session.status === "completed") await refreshAfterPractice(client, target);
    },
  });
};

export const useAbandonPracticeSession = (target: PracticeTarget, sessionId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => postAbandonPracticeSession(sessionId),
    onSuccess: async () => {
      client.removeQueries({ queryKey: flashcardKeys.practiceSession(sessionId) });
      await refreshAfterPractice(client, target);
    },
  });
};

/**
 * Due times pass while the page is open: refresh the collection (list, availability, summary)
 * when the next review comes due, so "Revisar agora" and the Praticar button agree.
 */
export const useRefreshWhenDue = (
  collectionId: string,
  nextPracticeAt: string | null | undefined,
) => {
  const client = useQueryClient();
  useEffect(() => {
    if (!nextPracticeAt) return;
    const delay = new Date(nextPracticeAt).getTime() - Date.now();
    // Past due is already reflected; beyond the timer limit a reload will happen first.
    if (delay <= 0 || delay > 2_147_483_647) return;
    const timer = window.setTimeout(() => {
      void client.invalidateQueries({ queryKey: flashcardKeys.collection(collectionId) });
      void client.invalidateQueries({ queryKey: flashcardCollectionKeys.all });
    }, delay + 1_000);
    return () => window.clearTimeout(timer);
  }, [client, collectionId, nextPracticeAt]);
};

export const useFlashcardCollection = (collectionId: string, enabled = true) =>
  useQuery({
    enabled,
    queryKey: flashcardKeys.collection(collectionId),
    queryFn: ({ signal }) => fetchFlashcardCollection(collectionId, signal),
  });

export const useFlashcards = (collectionId: string, input: FlashcardListQuery) =>
  useQuery({
    enabled: Boolean(collectionId),
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
      client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.studyMetrics }),
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
  const client = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => removeFlashcard(collectionId, cardId),
    onSuccess: (_result, cardId) => {
      client.removeQueries({ queryKey: flashcardKeys.detail(collectionId, cardId) });
      return invalidate();
    },
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
