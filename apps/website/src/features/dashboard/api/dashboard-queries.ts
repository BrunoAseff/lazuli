import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { dismissDashboardOnboarding, fetchDashboard, getClientTimeZone } from "./dashboard-api.ts";

export const dashboardKeys = {
  all: QUERY_KEY_ROOTS.dashboard,
  summary: () => [...QUERY_KEY_ROOTS.dashboard, "summary"] as const,
  summaryForTimeZone: (timeZone: string) => [...dashboardKeys.summary(), timeZone] as const,
};

export const useDashboard = () => {
  const timeZone = getClientTimeZone();
  return useQuery({
    queryKey: dashboardKeys.summaryForTimeZone(timeZone),
    queryFn: ({ signal }) => fetchDashboard(timeZone, signal),
  });
};

export const useDismissDashboardOnboarding = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: dismissDashboardOnboarding,
    onSuccess: () => client.invalidateQueries({ queryKey: dashboardKeys.summary() }),
  });
};
