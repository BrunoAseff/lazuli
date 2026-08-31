import {
  createReferencesResponseSchema,
  referenceListResponseSchema,
  type CreateReferencesInput,
  type CreateReferencesResponse,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from "@lazuli/shared";

import { apiRequest } from "@/lib/api-client.ts";

export const fetchReferences = (
  input: ReferenceListQuery,
  signal?: AbortSignal,
): Promise<ReferenceListResponse> => {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.targetType) params.set("targetType", input.targetType);
  if (input.targetId) params.set("targetId", input.targetId);
  if (input.documentId) params.set("documentId", input.documentId);
  if (input.anchorId) params.set("anchorId", input.anchorId);
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
