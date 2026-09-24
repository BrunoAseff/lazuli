import { getApiErrorMessage } from "@/lib/api-client.ts";

export const getQuizCollectionErrorMessage = (error: unknown, fallback: string) =>
  getApiErrorMessage(error, fallback);
