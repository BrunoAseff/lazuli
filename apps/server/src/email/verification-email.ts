import { APP_NAME } from "@lazuli/shared";

import { createTransactionalEmailHtml, escapeEmailHtml } from "./transactional-email.ts";

export const createVerificationEmail = ({ name, url }: { name: string; url: string }) => {
  const safeName = escapeEmailHtml(name);

  return {
    subject: `Confirme seu e-mail no ${APP_NAME}`,
    text: `Olá, ${name}. Confirme seu e-mail para começar a usar o ${APP_NAME}: ${url}\n\nSe você não criou esta conta, ignore esta mensagem.`,
    html: createTransactionalEmailHtml({
      action: { href: url, label: "Confirmar e-mail" },
      childrenHtml: `<p style="margin:0;color:#362233;font-size:16px;line-height:1.65">Olá, ${safeName}. Confirme seu endereço para ativar sua conta e começar a organizar seus estudos.</p>`,
      footerHtml:
        "Este link expira em uma hora. Se você não criou esta conta, pode ignorar esta mensagem com segurança.",
      preheader: `Confirme seu endereço para começar a usar o ${APP_NAME}.`,
      title: "Confirme seu e-mail",
    }),
  };
};
