import {
  aiSelectionGenerationResponseSchema,
  approveAiSelectionGenerationResponseSchema,
  type ApproveAiSelectionGenerationInput,
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
