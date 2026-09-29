export const aiErrorCodes = [
  "AI_CONFIGURATION_ERROR",
  "AI_CONCURRENCY_LIMITED",
  "AI_INPUT_TOO_LARGE",
  "AI_INVALID_OUTPUT",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_RATE_LIMITED",
  "AI_REQUEST_FAILED",
  "AI_TIMEOUT",
] as const;

export type AiErrorCode = (typeof aiErrorCodes)[number];

const safeMessages: Record<AiErrorCode, string> = {
  AI_CONFIGURATION_ERROR: "A geração por IA não está configurada neste ambiente.",
  AI_CONCURRENCY_LIMITED: "Já existem gerações em andamento. Aguarde a conclusão.",
  AI_INPUT_TOO_LARGE: "O conteúdo selecionado é grande demais para esta geração.",
  AI_INVALID_OUTPUT: "A IA não retornou um material válido. Tente novamente.",
  AI_PROVIDER_UNAVAILABLE: "O serviço de IA está temporariamente indisponível.",
  AI_RATE_LIMITED: "Muitas gerações foram solicitadas em pouco tempo. Aguarde e tente novamente.",
  AI_REQUEST_FAILED: "Não foi possível concluir a geração por IA.",
  AI_TIMEOUT: "A geração demorou mais que o permitido. Tente novamente.",
};

export class AiGenerationError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;

  constructor(code: AiErrorCode, options?: { cause?: unknown; retryable?: boolean }) {
    super(safeMessages[code], { cause: options?.cause });
    this.name = "AiGenerationError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}

const hasProperty = (value: unknown, property: string): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && property in value;

export const normalizeAiError = (error: unknown) => {
  if (error instanceof AiGenerationError) return error;
  if (error instanceof ZodError)
    return new AiGenerationError("AI_INVALID_OUTPUT", { cause: error });
  if (error instanceof DOMException && error.name === "TimeoutError")
    return new AiGenerationError("AI_TIMEOUT", { cause: error, retryable: true });

  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError")
    return new AiGenerationError("AI_TIMEOUT", { cause: error, retryable: true });

  const statusCode = hasProperty(error, "statusCode") ? error.statusCode : undefined;
  const retryable = hasProperty(error, "isRetryable") && error.isRetryable === true;
  if (statusCode === 429)
    return new AiGenerationError("AI_RATE_LIMITED", { cause: error, retryable: true });
  if (retryable || (typeof statusCode === "number" && statusCode >= 500))
    return new AiGenerationError("AI_PROVIDER_UNAVAILABLE", { cause: error, retryable: true });

  if (name.includes("Output") || name.includes("Validation"))
    return new AiGenerationError("AI_INVALID_OUTPUT", { cause: error });
  return new AiGenerationError("AI_REQUEST_FAILED", { cause: error });
};
import { ZodError } from "zod";
