import { APP_NAME } from "@lazuli/shared";

import { createTransactionalEmailHtml, escapeEmailHtml } from "./transactional-email.ts";

export const createChangeEmailConfirmation = ({ name, url }: { name: string; url: string }) => {
  const safeName = escapeEmailHtml(name);
  return {
    subject: `Confirme a alteração do seu e-mail no ${APP_NAME}`,
    text: `Olá, ${name}. Confirme a alteração do endereço de e-mail da sua conta: ${url}\n\nSe você não solicitou esta alteração, não use o link.`,
    html: createTransactionalEmailHtml({
      action: { href: url, label: "Confirmar alteração" },
      childrenHtml: `<p style="margin:0;color:#362233;font-size:16px;line-height:1.65">Olá, ${safeName}. Recebemos uma solicitação para alterar o endereço de e-mail da sua conta.</p>`,
      footerHtml:
        "O novo endereço ainda precisará ser verificado. Se você não solicitou esta alteração, não use o link e altere sua senha.",
      preheader: `Confirme a alteração do endereço da sua conta no ${APP_NAME}.`,
      title: "Confirme a alteração",
    }),
  };
};
