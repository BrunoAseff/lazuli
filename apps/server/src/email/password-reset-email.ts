import { APP_NAME } from "@lazuli/shared";

import {
  createTransactionalEmailHtml,
  emailParagraph,
  escapeEmailHtml,
} from "./transactional-email.ts";

export const createPasswordResetEmail = ({
  name,
  url,
  websiteUrl,
}: {
  name: string;
  url: string;
  websiteUrl?: string;
}) => {
  const safeName = escapeEmailHtml(name);

  return {
    subject: `Redefina sua senha no ${APP_NAME}`,
    text: `Olá, ${name}. Use este link para definir uma nova senha no ${APP_NAME}: ${url}\n\nSe você não solicitou esta alteração, ignore esta mensagem.`,
    html: createTransactionalEmailHtml({
      websiteUrl,
      action: { href: url, label: "Redefinir senha" },
      childrenHtml: `${emailParagraph(`Olá, ${safeName}. Recebemos uma solicitação para redefinir a senha da sua conta.`)}`,
      footerHtml:
        "Este link expira em uma hora e pode ser usado apenas uma vez. Se você não solicitou esta alteração, ignore esta mensagem com segurança.",
      preheader: `Defina uma nova senha para sua conta no ${APP_NAME}.`,
      title: "Redefina sua senha",
    }),
  };
};
