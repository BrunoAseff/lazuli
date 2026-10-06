import {
  aiCollectionGenerationResponseSchema,
  aiMaterialImprovementResponseSchema,
  aiSelectionGenerationResponseSchema,
  applyAiMaterialImprovementResponseSchema,
  approveAiSelectionGenerationResponseSchema,
  type ApproveAiSelectionGenerationInput,
  type ApplyAiMaterialImprovementInput,
  type CreateAiCollectionGenerationInput,
  type CreateAiSelectionGenerationInput,
  type CreateAiMaterialImprovementInput,
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

export const createAiMaterialImprovement = (input: CreateAiMaterialImprovementInput) =>
  apiRequest("/api/ai/material-improvements", aiMaterialImprovementResponseSchema, {
    body: JSON.stringify(input),
    method: "POST",
  });

export const fetchAiMaterialImprovement = (operationId: string, signal?: AbortSignal) =>
  apiRequest(`/api/ai/material-improvements/${operationId}`, aiMaterialImprovementResponseSchema, {
    signal,
  });

export const applyAiMaterialImprovement = (
  operationId: string,
  input: ApplyAiMaterialImprovementInput,
) =>
  apiRequest(
    `/api/ai/material-improvements/${operationId}/apply`,
    applyAiMaterialImprovementResponseSchema,
    { body: JSON.stringify(input), method: "POST" },
  );

export const discardAiMaterialImprovement = (operationId: string) =>
  apiRequest(`/api/ai/material-improvements/${operationId}`, null, { method: "DELETE" });
