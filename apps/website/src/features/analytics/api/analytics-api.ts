import {
  analyticsPreferenceSchema,
  updateAnalyticsPreferenceSchema,
  type UpdateAnalyticsPreference,
} from "@lazuli/shared";

import { apiRequest } from "@/lib/api-client.ts";

export const fetchAnalyticsPreference = (signal?: AbortSignal) =>
  apiRequest("/api/analytics/preferences", analyticsPreferenceSchema, { signal });

export const putAnalyticsPreference = (input: UpdateAnalyticsPreference) =>
  apiRequest("/api/analytics/preferences", analyticsPreferenceSchema, {
    method: "PUT",
    body: JSON.stringify(updateAnalyticsPreferenceSchema.parse(input)),
  });
