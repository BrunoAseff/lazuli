import { APP_NAME } from "@lazuli/shared";

import { createTransactionalEmailHtml, escapeEmailHtml } from "./transactional-email.ts";

export const createPasswordResetEmail = ({ name, url }: { name: string; url: string }) => {
  const safeName = escapeEmailHtml(name);

  return {
    subject: `Redefina sua senha no ${APP_NAME}`,
    text: `Olá, ${name}. Use este link para definir uma nova senha no ${APP_NAME}: ${url}\n\nSe você não solicitou esta alteração, ignore esta mensagem.`,
    html: createTransactionalEmailHtml({
      action: { href: url, label: "Redefinir senha" },
      childrenHtml: `<p style="margin:0;color:#362233;font-size:16px;line-height:1.65">Olá, ${safeName}. Recebemos uma solicitação para redefinir a senha da sua conta.</p>`,
      footerHtml:
        "Este link expira em uma hora e pode ser usado apenas uma vez. Se você não solicitou esta alteração, ignore esta mensagem com segurança.",
      preheader: `Defina uma nova senha para sua conta no ${APP_NAME}.`,
      title: "Redefina sua senha",
    }),
  };
};
