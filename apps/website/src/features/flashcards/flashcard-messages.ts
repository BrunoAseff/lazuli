import {
  FLASHCARD_IMPORT_MAX_BYTES,
  FLASHCARD_IMPORT_MAX_ROWS,
  IMAGE_MAX_BYTES,
} from "@lazuli/shared";

import { ApiError } from "@/lib/api-client.ts";

const megabytes = (bytes: number) => bytes / (1024 * 1024);

const messages: Record<string, string> = {
  PROJECT_NOT_FOUND: "O projeto escolhido não está mais disponível.",
  COLLECTION_NOT_FOUND: "Esta coleção não está mais disponível.",
  FLASHCARD_NOT_FOUND: "Este flashcard não está mais disponível.",
  INVALID_ASSETS: "Uma das imagens não está mais disponível.",
  STORAGE_LIMIT_REACHED: "Seu limite de armazenamento foi atingido.",
  IMAGE_TOO_LARGE: `A imagem deve ter no máximo ${megabytes(IMAGE_MAX_BYTES)} MB.`,
  RATE_LIMITED: "Muitas alterações foram feitas em pouco tempo. Aguarde e tente novamente.",
  COLLECTION_ARCHIVED: "Restaure a coleção antes de praticar.",
  NO_CARDS_AVAILABLE: "Não há flashcards disponíveis agora.",
  PRACTICE_SESSION_ACTIVE: "Já existe uma prática em andamento.",
  PRACTICE_SESSION_FINISHED: "Esta prática já foi encerrada.",
  REVIEW_CONFLICT: "A prática avançou em outra janela. Recarregue para continuar.",
  FLASHCARD_IMPORT_INVALID_FILE: "Use um arquivo CSV, TSV ou TXT válido em UTF-8.",
  FLASHCARD_IMPORT_TOO_LARGE: `O arquivo deve ter no máximo ${megabytes(FLASHCARD_IMPORT_MAX_BYTES)} MB.`,
  FLASHCARD_IMPORT_TOO_MANY_ROWS: `Importe no máximo ${FLASHCARD_IMPORT_MAX_ROWS.toLocaleString("pt-BR")} flashcards por vez.`,
  FLASHCARD_IMPORT_NO_VALID_ROWS: "Nenhum par de pergunta e resposta foi encontrado.",
  FLASHCARD_IMPORT_CONFLICT: "Não foi possível concluir esta importação. Tente novamente.",
};

export const getFlashcardCollectionErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError
    ? ((error.code ? messages[error.code] : undefined) ?? fallback)
    : fallback;
