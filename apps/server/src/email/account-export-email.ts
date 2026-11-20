import { APP_NAME } from "@lazuli/shared";

import {
  createTransactionalEmailHtml,
  emailParagraph,
  escapeEmailHtml,
} from "./transactional-email.ts";

export const createAccountExportEmail = ({ name }: { name: string }) => {
  const safeName = escapeEmailHtml(name);
  return {
    subject: `Sua cópia de dados do ${APP_NAME} está pronta`,
    text: `Olá, ${name}. Sua cópia de dados está anexada a este e-mail. Os dados tabulares estão em arquivos CSV e podem ser abertos em qualquer aplicativo de planilhas.`,
    html: createTransactionalEmailHtml({
      childrenHtml: `${emailParagraph(`Olá, ${safeName}. A cópia dos dados que você selecionou está anexada a este e-mail.`)}${emailParagraph(`Os dados tabulares estão em arquivos CSV e podem ser abertos no Excel, Google Planilhas ou outro aplicativo de planilhas. Seus arquivos originais foram mantidos nos respectivos formatos.`, { secondary: true })}`,
      footerHtml: "Este arquivo foi gerado exclusivamente para você. Guarde-o em um local seguro.",
      preheader: `Sua cópia de dados do ${APP_NAME} está anexada.`,
      title: "Sua cópia está pronta",
    }),
  };
};
