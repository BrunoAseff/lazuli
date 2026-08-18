type ProjectApiError = {
  code?: string;
  status?: number;
};

const messagesByCode: Record<string, string> = {
  PROJECT_CREATE_CONFLICT: "Não foi possível concluir esta criação. Tente novamente.",
  PROJECT_NOT_FOUND: "Este projeto não foi encontrado.",
  UNAUTHORIZED: "Sua sessão expirou. Entre novamente para continuar.",
  UNTRUSTED_ORIGIN: "Não foi possível validar esta solicitação.",
  VALIDATION_ERROR: "Revise os dados informados e tente novamente.",
};

export const getProjectErrorMessage = (
  error: ProjectApiError | null,
  fallback = "Não foi possível concluir esta ação. Tente novamente.",
) => {
  if (error?.code && messagesByCode[error.code]) {
    return messagesByCode[error.code];
  }
  return fallback;
};
