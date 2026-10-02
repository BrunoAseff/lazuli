import {
  aiCollectionGenerationResponseSchema,
  aiSelectionGenerationResponseSchema,
  approveAiSelectionGenerationResponseSchema,
  type ApproveAiSelectionGenerationInput,
  type CreateAiCollectionGenerationInput,
  type CreateAiSelectionGenerationInput,
} from "@lazuli/shared";
import { z } from "zod";

import { apiRequest } from "@/lib/api-client.ts";

const aiCreditBalanceSchema = z.object({
  available: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
});

export const fetchAiCreditBalance = (signal?: AbortSignal) =>
  apiRequest("/api/ai/credits", aiCreditBalanceSchema, { signal });

export const createAiSelectionGeneration = (input: CreateAiSelectionGenerationInput) =>
  apiRequest("/api/ai/selection-generations", aiSelectionGenerationResponseSchema, {
    body: JSON.stringify(input),
    method: "POST",
  });

export const createAiCollectionGeneration = (input: CreateAiCollectionGenerationInput) =>
  apiRequest("/api/ai/collection-generations", aiCollectionGenerationResponseSchema, {
    body: JSON.stringify(input),
    method: "POST",
  });

export const fetchLatestAiCollectionGeneration = (collectionId: string, signal?: AbortSignal) =>
  apiRequest(
    `/api/ai/collection-generations/latest?collectionId=${encodeURIComponent(collectionId)}`,
    aiCollectionGenerationResponseSchema,
    { signal },
  );

export const fetchAiCollectionGeneration = (operationId: string, signal?: AbortSignal) =>
  apiRequest(`/api/ai/generations/${operationId}`, aiCollectionGenerationResponseSchema, {
    signal,
  });

export const discardAiCollectionGeneration = (operationId: string) =>
  apiRequest(`/api/ai/collection-generations/${operationId}`, null, { method: "DELETE" });

export const fetchAiGeneration = (operationId: string, signal?: AbortSignal) =>
  apiRequest(`/api/ai/generations/${operationId}`, aiSelectionGenerationResponseSchema, {
    signal,
  });

export const approveAiGeneration = (
  operationId: string,
  input: ApproveAiSelectionGenerationInput,
) =>
  apiRequest(
    `/api/ai/generations/${operationId}/approve`,
    approveAiSelectionGenerationResponseSchema,
    { body: JSON.stringify(input), method: "POST" },
  );
