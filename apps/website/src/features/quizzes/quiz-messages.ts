import { IMAGE_MAX_BYTES } from "@lazuli/shared";

import { getApiErrorMessage } from "@/lib/api-client.ts";

const megabytes = (bytes: number) => bytes / (1024 * 1024);

/** What each server refusal means for the person, as the flashcards say theirs. */
const messages: Record<string, string> = {
  PROJECT_NOT_FOUND: "O projeto escolhido não está mais disponível.",
  COLLECTION_NOT_FOUND: "Esta coleção não está mais disponível.",
  QUESTION_NOT_FOUND: "Esta questão não está mais disponível.",
  ATTEMPT_NOT_FOUND: "Esta tentativa não está mais disponível.",
  ATTEMPT_NOT_ACTIVE: "Esta tentativa já foi encerrada.",
  ACTIVE_ATTEMPT_EXISTS: "Já existe uma tentativa em andamento nesta coleção.",
  EMPTY_QUIZ: "Crie ao menos uma questão antes de iniciar.",
  INCOMPLETE_ATTEMPT: "Responda todas as questões antes de concluir.",
  QUIZ_TOO_LARGE: "Este quiz deve ter no máximo 200 questões por tentativa.",
  INVALID_QUIZ: "Revise as questões e alternativas antes de iniciar.",
  INVALID_ASSETS: "Uma das imagens não está mais disponível.",
  STORAGE_LIMIT_REACHED: "Seu limite de armazenamento foi atingido.",
  PLAN_STORAGE_LIMIT_REACHED: "Seu limite de armazenamento foi atingido.",
  IMAGE_TOO_LARGE: `A imagem deve ter no máximo ${megabytes(IMAGE_MAX_BYTES)} MB.`,
  RATE_LIMITED: "Muitas alterações foram feitas em pouco tempo. Aguarde e tente novamente.",
};

export const getQuizCollectionErrorMessage = (error: unknown, fallback: string) =>
  getApiErrorMessage(error, fallback, messages);
