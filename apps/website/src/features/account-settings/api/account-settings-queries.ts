import {
  accountUsageSchema,
  type CreateAccountExportInput,
  type DeleteAccountInput,
} from "@lazuli/shared";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client.ts";
import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { analyticsPreferenceQuery } from "@/features/analytics/api/analytics-queries.ts";
import {
  deleteAccount,
  fetchAccountProfile,
  fetchAccountSessions,
  fetchAuthCapabilities,
  fetchStudyPreference,
  putStudyPreference,
  requestAccountExport,
  revokeAccountSession,
  revokeOtherAccountSessions,
  updateAccountName,
} from "./account-settings-api.ts";

export const accountSettingsKeys = {
  all: QUERY_KEY_ROOTS.accountSettings,
  capabilities: () => [...QUERY_KEY_ROOTS.accountSettings, "capabilities"] as const,
  profile: () => [...QUERY_KEY_ROOTS.accountSettings, "profile"] as const,
  sessions: () => [...QUERY_KEY_ROOTS.accountSettings, "sessions"] as const,
  study: () => [...QUERY_KEY_ROOTS.accountSettings, "study"] as const,
  usage: () => [...QUERY_KEY_ROOTS.accountSettings, "usage"] as const,
};

export const accountUsageQuery = () => ({
  queryKey: accountSettingsKeys.usage(),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    apiRequest("/api/account-settings/usage", accountUsageSchema, { signal }),
});

export const useAuthCapabilities = () =>
  useQuery({
    queryKey: accountSettingsKeys.capabilities(),
    queryFn: ({ signal }) => fetchAuthCapabilities(signal),
    // Fresh from the prefetch when Settings opens; linking or unlinking invalidates it.
    staleTime: 60_000,
  });

export const useAccountProfile = () =>
  useQuery({
    queryKey: accountSettingsKeys.profile(),
    queryFn: ({ signal }) => fetchAccountProfile(signal),
  });

export const useUpdateAccountName = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateAccountName,
    onSuccess: (profile) => client.setQueryData(accountSettingsKeys.profile(), profile),
  });
};

export const useStudyPreference = () =>
  useQuery({
    queryKey: accountSettingsKeys.study(),
    queryFn: ({ signal }) => fetchStudyPreference(signal),
  });

export const useUpdateStudyPreference = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: putStudyPreference,
    onSuccess: (preference) => client.setQueryData(accountSettingsKeys.study(), preference),
  });
};

export const useAccountSessions = () =>
  useQuery({
    queryKey: accountSettingsKeys.sessions(),
    queryFn: ({ signal }) => fetchAccountSessions(signal),
  });

export const useRevokeAccountSession = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: revokeAccountSession,
    onSuccess: () => client.invalidateQueries({ queryKey: accountSettingsKeys.sessions() }),
  });
};

export const useRevokeOtherAccountSessions = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: revokeOtherAccountSessions,
    onSuccess: () => client.invalidateQueries({ queryKey: accountSettingsKeys.sessions() }),
  });
};

export const useRequestAccountExport = () =>
  useMutation({ mutationFn: (input: CreateAccountExportInput) => requestAccountExport(input) });

export const useDeleteAccount = () =>
  useMutation({ mutationFn: (input: DeleteAccountInput) => deleteAccount(input) });

/**
 * Everything the settings sections read, fetched as soon as Settings opens, so switching tabs
 * shows the section instead of waiting for it.
 */
export const prefetchAccountSettings = (client: QueryClient, userId: string) =>
  Promise.allSettled([
    client.prefetchQuery(accountUsageQuery()),
    ...(userId ? [client.prefetchQuery(analyticsPreferenceQuery(userId))] : []),
    client.prefetchQuery({
      queryKey: accountSettingsKeys.profile(),
      queryFn: ({ signal }) => fetchAccountProfile(signal),
    }),
    client.prefetchQuery({
      queryKey: accountSettingsKeys.capabilities(),
      queryFn: ({ signal }) => fetchAuthCapabilities(signal),
    }),
    client.prefetchQuery({
      queryKey: accountSettingsKeys.study(),
      queryFn: ({ signal }) => fetchStudyPreference(signal),
    }),
    client.prefetchQuery({
      queryKey: accountSettingsKeys.sessions(),
      queryFn: ({ signal }) => fetchAccountSessions(signal),
    }),
  ]);
