import { ApiError } from "@/lib/api-client.ts";

export const getQuizCollectionErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;
