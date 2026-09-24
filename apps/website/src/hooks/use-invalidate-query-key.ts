import { type QueryKey, useQueryClient } from "@tanstack/react-query";

export const useInvalidateQueryKey = (queryKey: QueryKey) => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey });
};
