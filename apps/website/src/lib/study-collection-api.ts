import type { ZodType } from "zod";

import { apiRequest } from "@/lib/api-client.ts";
import { buildSearchParams } from "@/lib/search-params.ts";

type CollectionListQuery = {
  page: number;
  pageSize: number;
  project?: string;
  query: string;
  status: string;
};

export const createStudyCollectionApi = <
  Summary,
  ListResponse,
  CreateInput,
  UpdateInput,
  ListQuery extends CollectionListQuery,
>({
  collectionSchema,
  listSchema,
  path,
}: {
  collectionSchema: ZodType<Summary>;
  listSchema: ZodType<ListResponse>;
  path: string;
}) => {
  const collectionPath = (collectionId: string) => `${path}/${encodeURIComponent(collectionId)}`;

  return {
    fetchCollection: (collectionId: string, signal?: AbortSignal): Promise<Summary> =>
      apiRequest(collectionPath(collectionId), collectionSchema, { signal }),
    fetchCollections: (input: ListQuery, signal?: AbortSignal): Promise<ListResponse> => {
      const params = buildSearchParams({
        page: input.page,
        pageSize: input.pageSize,
        project: input.project,
        query: input.query,
        status: input.status,
      });
      return apiRequest(`${path}?${params}`, listSchema, { signal });
    },
    patchCollection: (collectionId: string, input: UpdateInput): Promise<Summary> =>
      apiRequest(collectionPath(collectionId), collectionSchema, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    postCollection: (input: CreateInput): Promise<Summary> =>
      apiRequest(path, collectionSchema, {
        body: JSON.stringify(input),
        method: "POST",
      }),
    removeCollection: (collectionId: string): Promise<void> =>
      apiRequest(collectionPath(collectionId), null, { method: "DELETE" }),
  };
};
