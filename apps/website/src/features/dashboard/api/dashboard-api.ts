import {
  dashboardOnboardingDismissalSchema,
  dashboardResponseSchema,
  type DashboardResponse,
} from "@lazuli/shared";

import { apiRequest as request } from "@/lib/api-client.ts";

export const getClientTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const fetchDashboard = (
  timeZone: string,
  signal?: AbortSignal,
): Promise<DashboardResponse> =>
  request(
    `/api/dashboard?${new URLSearchParams({ tz: timeZone }).toString()}`,
    dashboardResponseSchema,
    { signal },
  );

export const dismissDashboardOnboarding = () =>
  request("/api/dashboard/onboarding", dashboardOnboardingDismissalSchema, {
    method: "PATCH",
    body: JSON.stringify({ dismissed: true }),
  });
