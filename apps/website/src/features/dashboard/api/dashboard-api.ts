import {
  dashboardOnboardingDismissalSchema,
  dashboardResponseSchema,
  type DashboardResponse,
} from "@lazuli/shared";

import { apiRequest as request } from "@/lib/api-client.ts";

export const fetchDashboard = (signal?: AbortSignal): Promise<DashboardResponse> =>
  request("/api/dashboard", dashboardResponseSchema, { signal });

export const dismissDashboardOnboarding = () =>
  request("/api/dashboard/onboarding", dashboardOnboardingDismissalSchema, {
    method: "PATCH",
    body: JSON.stringify({ dismissed: true }),
  });
