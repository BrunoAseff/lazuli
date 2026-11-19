import type { CreateReferencesInput, ReferenceListQuery } from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import {
  fetchProjectDocumentMaterials,
  fetchReferences,
  postReferences,
  removeReference,
} from "./reference-api.ts";

export const referenceKeys = {
  all: QUERY_KEY_ROOTS.references,
  lists: () => [...referenceKeys.all, "list"] as const,
  list: (input: ReferenceListQuery) => [...referenceKeys.lists(), input] as const,
  projectDocuments: (projectId: string) =>
    [...referenceKeys.all, "project-documents", projectId] as const,
};

/** How many materials each document of a project has; refreshed with every reference change. */
export const useProjectDocumentMaterials = (projectId: string) =>
  useQuery({
    queryFn: ({ signal }) => fetchProjectDocumentMaterials(projectId, signal),
    queryKey: referenceKeys.projectDocuments(projectId),
  });

export const useReferences = (input: ReferenceListQuery, enabled = true) =>
  useQuery({
    enabled,
    queryFn: ({ signal }) => fetchReferences(input, signal),
    queryKey: referenceKeys.list(input),
    retry: false,
  });

const useInvalidateReferences = () => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: referenceKeys.all });
};

export const useCreateReferences = () => {
  const invalidate = useInvalidateReferences();
  return useMutation({
    mutationFn: (input: CreateReferencesInput) => postReferences(input),
    onSuccess: invalidate,
  });
};

export const useDeleteReference = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: removeReference,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: referenceKeys.all }),
        client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.documents }),
      ]),
  });
};
