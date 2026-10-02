import type {
  ApproveAiSelectionGenerationInput,
  CreateAiSelectionGenerationInput,
} from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { quizKeys } from "@/features/quizzes/api/quiz-queries.ts";
import {
  approveAiGeneration,
  createAiSelectionGeneration,
  fetchAiCreditBalance,
  fetchAiGeneration,
} from "./ai-api.ts";

export const aiKeys = {
  balance: [...QUERY_KEY_ROOTS.ai, "balance"] as const,
  generation: (operationId: string) => [...QUERY_KEY_ROOTS.ai, "generation", operationId] as const,
};

export const useAiCreditBalance = () =>
  useQuery({ queryKey: aiKeys.balance, queryFn: ({ signal }) => fetchAiCreditBalance(signal) });

export const useAiGeneration = (operationId: string) =>
  useQuery({
    enabled: Boolean(operationId),
    queryKey: aiKeys.generation(operationId),
    queryFn: ({ signal }) => fetchAiGeneration(operationId, signal),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1_000 : false),
  });

export const useCreateAiSelectionGeneration = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiSelectionGenerationInput) => createAiSelectionGeneration(input),
    onSuccess: async (result) => {
      if (result.status === "completed")
        client.setQueryData(aiKeys.generation(result.draft.operationId), result);
      await client.invalidateQueries({ queryKey: aiKeys.balance });
    },
  });
};

export const useApproveAiGeneration = (operationId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ApproveAiSelectionGenerationInput) =>
      approveAiGeneration(operationId, input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: aiKeys.balance }),
        client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.flashcards }),
        client.invalidateQueries({ queryKey: quizKeys.all }),
        client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.flashcardCollections }),
        client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.quizCollections }),
      ]);
    },
  });
};
