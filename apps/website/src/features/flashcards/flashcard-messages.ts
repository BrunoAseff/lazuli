import { ApiError } from "@/lib/api-client.ts";

const messages: Record<string, string> = {
  PROJECT_NOT_FOUND: "O projeto escolhido não está mais disponível.",
  COLLECTION_NOT_FOUND: "Esta coleção não está mais disponível.",
  RATE_LIMITED: "Muitas alterações foram feitas em pouco tempo. Aguarde e tente novamente.",
};

export const getFlashcardCollectionErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError
    ? ((error.code ? messages[error.code] : undefined) ?? error.message ?? fallback)
    : fallback;
