import {
  createReferencesResponseSchema,
  referenceListResponseSchema,
  type CreateReferencesInput,
  type CreateReferencesResponse,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from "@lazuli/shared";

import { apiRequest } from "@/lib/api-client.ts";
import { buildSearchParams } from "@/lib/search-params.ts";

export const fetchReferences = (
  input: ReferenceListQuery,
  signal?: AbortSignal,
): Promise<ReferenceListResponse> => {
  const params = buildSearchParams({
    anchorId: input.anchorId,
    documentId: input.documentId,
    page: input.page,
    pageSize: input.pageSize,
    targetId: input.targetId,
    targetType: input.targetType,
  });
  return apiRequest(`/api/references?${params}`, referenceListResponseSchema, { signal });
};

export const postReferences = (input: CreateReferencesInput): Promise<CreateReferencesResponse> =>
  apiRequest("/api/references", createReferencesResponseSchema, {
    body: JSON.stringify(input),
    method: "POST",
  });

export const removeReference = (referenceId: string) =>
  apiRequest(`/api/references/${encodeURIComponent(referenceId)}`, null, {
    method: "DELETE",
  });
