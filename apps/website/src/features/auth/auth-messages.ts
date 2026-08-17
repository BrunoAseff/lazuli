type AuthError = {
  code?: string;
  status?: number;
};

const messagesByCode: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail antes de entrar.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_NAME: "Informe um nome entre 2 e 80 caracteres.",
  INVALID_PASSWORD: "A senha informada não é válida.",
  INVALID_TOKEN: "Este link de confirmação não é válido. Solicite um novo link.",
  TOKEN_EXPIRED: "Este link de confirmação expirou. Solicite um novo link.",
  TOO_MANY_REQUESTS: "Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.",
};

export const getAuthErrorMessage = (
  error: AuthError | null,
  fallback = "Não foi possível concluir esta ação. Tente novamente.",
) => {
  if (!error) {
    return fallback;
  }

  if (error.code && messagesByCode[error.code]) {
    return messagesByCode[error.code];
  }

  if (error.status === 429) {
    return messagesByCode.TOO_MANY_REQUESTS;
  }

  return fallback;
};
