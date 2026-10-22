import {
  accountSessionsSchema,
  accountSettingsProfileSchema,
  authCapabilitiesSchema,
  createAccountExportSchema,
  deleteAccountSchema,
  studyPreferenceSchema,
  updateAccountNameSchema,
  updateStudyPreferenceSchema,
  type CreateAccountExportInput,
  type DeleteAccountInput,
  type UpdateStudyPreferenceInput,
} from "@lazuli/shared";
import { z } from "zod";

import { apiRequest } from "@/lib/api-client.ts";
import { ApiError } from "@/lib/api-client.ts";
import { authClient } from "@/features/auth/auth-client.ts";

const successSchema = z.object({ success: z.boolean() });
const revokeSessionSchema = successSchema.extend({ current: z.boolean() });

export const fetchAuthCapabilities = (signal?: AbortSignal) =>
  apiRequest("/api/auth/capabilities", authCapabilitiesSchema, { signal });

export const fetchAccountProfile = (signal?: AbortSignal) =>
  apiRequest("/api/account-settings/profile", accountSettingsProfileSchema, { signal });

export const updateAccountName = (name: string) =>
  authClient.updateUser(updateAccountNameSchema.parse({ name })).then(async ({ error }) => {
    if (error) throw new ApiError(error.status ?? 400, error.code, error);
    return fetchAccountProfile();
  });

export const fetchStudyPreference = (signal?: AbortSignal) =>
  apiRequest("/api/account-settings/study", studyPreferenceSchema, { signal });

export const putStudyPreference = (input: UpdateStudyPreferenceInput) =>
  apiRequest("/api/account-settings/study", studyPreferenceSchema, {
    body: JSON.stringify(updateStudyPreferenceSchema.parse(input)),
    method: "PUT",
  });

export const fetchAccountSessions = (signal?: AbortSignal) =>
  apiRequest("/api/account-settings/sessions", accountSessionsSchema, { signal });

export const revokeAccountSession = (sessionId: string) =>
  apiRequest(
    `/api/account-settings/sessions/${encodeURIComponent(sessionId)}`,
    revokeSessionSchema,
    {
      method: "DELETE",
    },
  );

export const revokeOtherAccountSessions = () =>
  apiRequest("/api/account-settings/sessions", successSchema, { method: "DELETE" });

export const requestAccountExport = (input: CreateAccountExportInput) =>
  apiRequest("/api/account-exports", successSchema, {
    body: JSON.stringify(createAccountExportSchema.parse(input)),
    method: "POST",
  });

export const deleteAccount = (input: DeleteAccountInput) =>
  apiRequest("/api/account", successSchema, {
    body: JSON.stringify(deleteAccountSchema.parse(input)),
    method: "DELETE",
  });
