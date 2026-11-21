import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { dismissDashboardOnboarding, fetchDashboard } from "./dashboard-api.ts";

export const dashboardKeys = {
  all: QUERY_KEY_ROOTS.dashboard,
  summary: () => [...QUERY_KEY_ROOTS.dashboard, "summary"] as const,
};

export const useDashboard = () =>
  useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: ({ signal }) => fetchDashboard(signal),
  });

export const useDismissDashboardOnboarding = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: dismissDashboardOnboarding,
    onSuccess: () => client.invalidateQueries({ queryKey: dashboardKeys.summary() }),
  });
};
