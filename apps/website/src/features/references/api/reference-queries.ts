import type { CreateReferencesInput, ReferenceListQuery } from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { fetchReferences, postReferences, removeReference } from "./reference-api.ts";

export const referenceKeys = {
  all: QUERY_KEY_ROOTS.references,
  lists: () => [...referenceKeys.all, "list"] as const,
  list: (input: ReferenceListQuery) => [...referenceKeys.lists(), input] as const,
};

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
  const invalidate = useInvalidateReferences();
  return useMutation({
    mutationFn: removeReference,
    onSuccess: invalidate,
  });
};
