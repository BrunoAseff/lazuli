import { APP_NAME } from "@lazuli/shared";

import { createTransactionalEmailHtml, emailParagraph } from "./transactional-email.ts";

/*
 * The name is left out on purpose: whoever signs up chooses it, and the message goes to an address
 * not yet proven to be theirs, so a name would let anyone put their text into our email.
 */
export const createVerificationEmail = ({
  url,
  websiteUrl,
}: {
  name?: string;
  url: string;
  websiteUrl?: string;
}) => ({
  subject: `Confirme seu e-mail no ${APP_NAME}`,
  text: `Olá. Confirme seu e-mail para começar a usar o ${APP_NAME}: ${url}\n\nSe você não criou esta conta, ignore esta mensagem.`,
  html: createTransactionalEmailHtml({
    websiteUrl,
    action: { href: url, label: "Confirmar e-mail" },
    childrenHtml: emailParagraph(
      "Olá. Confirme seu endereço para ativar sua conta e começar a organizar seus estudos.",
    ),
    footerHtml:
      "Este link expira em uma hora. Se você não criou esta conta, pode ignorar esta mensagem com segurança.",
    preheader: `Confirme seu endereço para começar a usar o ${APP_NAME}.`,
    title: "Confirme seu e-mail",
  }),
});
