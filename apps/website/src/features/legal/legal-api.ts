import { acceptLegalSchema, legalStatusSchema, type AcceptLegalInput } from "@lazuli/shared";
import { apiRequest } from "@/lib/api-client.ts";

export const fetchLegalStatus = (signal?: AbortSignal) =>
  apiRequest("/api/legal/status", legalStatusSchema, { signal });
export const acceptLegal = (input: AcceptLegalInput) =>
  apiRequest("/api/legal/acceptance", legalStatusSchema, {
    method: "POST",
    body: JSON.stringify(acceptLegalSchema.parse(input)),
  });
