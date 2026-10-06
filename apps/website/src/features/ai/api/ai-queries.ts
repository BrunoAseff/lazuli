import type {
  ApproveAiSelectionGenerationInput,
  ApplyAiMaterialImprovementInput,
  CreateAiCollectionGenerationInput,
  CreateAiSelectionGenerationInput,
  CreateAiMaterialImprovementInput,
} from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { quizKeys } from "@/features/quizzes/api/quiz-queries.ts";
import {
  approveAiGeneration,
  applyAiMaterialImprovement,
  createAiCollectionGeneration,
  createAiSelectionGeneration,
  createAiMaterialImprovement,
  discardAiMaterialImprovement,
  discardAiCollectionGeneration,
  fetchAiCreditBalance,
  fetchAiCollectionGeneration,
  fetchAiGeneration,
  fetchAiMaterialImprovement,
  fetchLatestAiCollectionGeneration,
} from "./ai-api.ts";

export const aiKeys = {
  balance: [...QUERY_KEY_ROOTS.ai, "balance"] as const,
  generation: (operationId: string) => [...QUERY_KEY_ROOTS.ai, "generation", operationId] as const,
  collectionGeneration: (operationId: string) =>
    [...QUERY_KEY_ROOTS.ai, "collection-generation", operationId] as const,
  latestCollectionGeneration: (collectionId: string) =>
    [...QUERY_KEY_ROOTS.ai, "collection-generation", "latest", collectionId] as const,
  materialImprovement: (operationId: string) =>
    [...QUERY_KEY_ROOTS.ai, "material-improvement", operationId] as const,
};

export const useAiCreditBalance = () =>
  useQuery({ queryKey: aiKeys.balance, queryFn: ({ signal }) => fetchAiCreditBalance(signal) });

export const useAiGeneration = (operationId: string) => {
  const client = useQueryClient();
  const previousStatus = useRef<"completed" | "error" | "running" | undefined>(undefined);
  const query = useQuery({
    enabled: Boolean(operationId),
    queryKey: aiKeys.generation(operationId),
    queryFn: ({ signal }) => fetchAiGeneration(operationId, signal),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1_000 : false),
  });
  const status = query.isError ? "error" : query.data?.status;

  useEffect(() => {
    if (previousStatus.current === "running" && status && status !== "running")
      void client.invalidateQueries({ queryKey: aiKeys.balance });
    previousStatus.current = status;
  }, [client, status]);

  return query;
};

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

export const useLatestAiCollectionGeneration = (collectionId: string, enabled = true) =>
  useQuery({
    enabled: enabled && Boolean(collectionId),
    queryKey: aiKeys.latestCollectionGeneration(collectionId),
    queryFn: ({ signal }) => fetchLatestAiCollectionGeneration(collectionId, signal),
    refetchInterval: (query) =>
      query.state.data?.status === "queued" || query.state.data?.status === "processing"
        ? 1_000
        : false,
  });

export const useAiCollectionGeneration = (operationId: string) =>
  useQuery({
    enabled: Boolean(operationId),
    queryKey: aiKeys.collectionGeneration(operationId),
    queryFn: ({ signal }) => fetchAiCollectionGeneration(operationId, signal),
    refetchInterval: (query) =>
      query.state.data?.status === "queued" || query.state.data?.status === "processing"
        ? 1_000
        : false,
  });

export const useCreateAiCollectionGeneration = (collectionId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiCollectionGenerationInput) => createAiCollectionGeneration(input),
    onSuccess: async (result) => {
      client.setQueryData(aiKeys.latestCollectionGeneration(collectionId), result);
      if (result.status !== "none" && result.status !== "completed")
        client.setQueryData(aiKeys.collectionGeneration(result.operationId), result);
      await client.invalidateQueries({ queryKey: aiKeys.balance });
    },
  });
};

export const useDiscardAiCollectionGeneration = (collectionId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: discardAiCollectionGeneration,
    onSuccess: async (_result, operationId) => {
      client.removeQueries({ exact: true, queryKey: aiKeys.collectionGeneration(operationId) });
      client.setQueryData(aiKeys.latestCollectionGeneration(collectionId), { status: "none" });
      await client.invalidateQueries({ queryKey: aiKeys.latestCollectionGeneration(collectionId) });
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
        client.invalidateQueries({ queryKey: [...QUERY_KEY_ROOTS.ai, "collection-generation"] }),
      ]);
    },
  });
};

export const useAiMaterialImprovement = (operationId: string) =>
  useQuery({
    enabled: Boolean(operationId),
    queryKey: aiKeys.materialImprovement(operationId),
    queryFn: ({ signal }) => fetchAiMaterialImprovement(operationId, signal),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1_000 : false),
  });

export const useCreateAiMaterialImprovement = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiMaterialImprovementInput) => createAiMaterialImprovement(input),
    onSuccess: async (result) => {
      if (result.status === "completed")
        client.setQueryData(aiKeys.materialImprovement(result.draft.operationId), result);
      await client.invalidateQueries({ queryKey: aiKeys.balance });
    },
  });
};

export const useApplyAiMaterialImprovement = (operationId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyAiMaterialImprovementInput) =>
      applyAiMaterialImprovement(operationId, input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.flashcards }),
        client.invalidateQueries({ queryKey: quizKeys.all }),
        client.invalidateQueries({ queryKey: aiKeys.balance }),
      ]);
    },
  });
};

export const useDiscardAiMaterialImprovement = (operationId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => discardAiMaterialImprovement(operationId),
    onSuccess: () => {
      client.removeQueries({ exact: true, queryKey: aiKeys.materialImprovement(operationId) });
    },
  });
};
