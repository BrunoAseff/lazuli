import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { fetchAnalyticsPreference, putAnalyticsPreference } from "./analytics-api.ts";

export const analyticsKeys = {
  all: QUERY_KEY_ROOTS.analytics,
  preference: (userId: string) => [...QUERY_KEY_ROOTS.analytics, "preference", userId] as const,
};

export const analyticsPreferenceQuery = (userId: string) => ({
  queryKey: analyticsKeys.preference(userId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchAnalyticsPreference(signal),
  staleTime: Number.POSITIVE_INFINITY,
});

export const useAnalyticsPreference = (userId: string) =>
  useQuery({ ...analyticsPreferenceQuery(userId), enabled: Boolean(userId) });

export const useUpdateAnalyticsPreference = (userId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: putAnalyticsPreference,
    onSuccess: (preference) => client.setQueryData(analyticsKeys.preference(userId), preference),
  });
};
