import { APP_NAME } from "@lazuli/shared";

import { createTransactionalEmailHtml, escapeEmailHtml } from "./transactional-email.ts";

export const createAccountExportEmail = ({ name }: { name: string }) => {
  const safeName = escapeEmailHtml(name);
  return {
    subject: `Sua cópia de dados do ${APP_NAME} está pronta`,
    text: `Olá, ${name}. Sua cópia de dados está anexada a este e-mail. Os dados tabulares estão em arquivos CSV e podem ser abertos em qualquer aplicativo de planilhas.`,
    html: createTransactionalEmailHtml({
      childrenHtml: `<p style="margin:0;color:#362233;font-size:16px;line-height:1.65">Olá, ${safeName}. A cópia dos dados que você selecionou está anexada a este e-mail.</p><p style="margin:16px 0 0;color:#6f5468;font-size:14px;line-height:1.6">Os dados tabulares estão em arquivos CSV e podem ser abertos no Excel, Google Planilhas ou outro aplicativo de planilhas. Seus arquivos originais foram mantidos nos respectivos formatos.</p>`,
      footerHtml: "Este arquivo foi gerado exclusivamente para você. Guarde-o em um local seguro.",
      preheader: `Sua cópia de dados do ${APP_NAME} está anexada.`,
      title: "Sua cópia está pronta",
    }),
  };
};
