import { APP_NAME } from "@lazuli/shared";

const EMAIL_COLORS = {
  background: "#f2edee",
  border: "#d2c6c9",
  foreground: "#362233",
  muted: "#735f70",
  primary: "#007bb8",
  primaryForeground: "#ffffff",
  surface: "#fffefd",
} as const;

export const escapeEmailHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

type TransactionalEmailOptions = {
  action: {
    href: string;
    label: string;
  };
  childrenHtml: string;
  footerHtml: string;
  preheader: string;
  title: string;
};

export const createTransactionalEmailHtml = ({
  action,
  childrenHtml,
  footerHtml,
  preheader,
  title,
}: TransactionalEmailOptions) => {
  const safeHref = escapeEmailHtml(action.href);
  const safeActionLabel = escapeEmailHtml(action.label);
  const safePreheader = escapeEmailHtml(preheader);
  const safeTitle = escapeEmailHtml(title);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_COLORS.background};color:${EMAIL_COLORS.foreground};font-family:'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${EMAIL_COLORS.background}">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px">
            <tr>
              <td style="padding:0 0 20px">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="42" height="42" align="center" valign="middle" style="width:42px;height:42px;border:1px solid #9ed6f2;border-radius:10px;background:#edf8fe;color:${EMAIL_COLORS.primary};font-size:20px;line-height:42px">◆</td>
                    <td style="padding-left:12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1;color:${EMAIL_COLORS.foreground}">${APP_NAME}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid ${EMAIL_COLORS.border};border-radius:16px;background:${EMAIL_COLORS.surface};padding:32px 24px">
                <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:500;line-height:1.2;color:${EMAIL_COLORS.foreground}">${safeTitle}</h1>
                ${childrenHtml}
                <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:28px auto 26px">
                  <tr>
                    <td bgcolor="${EMAIL_COLORS.primary}" style="border-radius:10px">
                      <a href="${safeHref}" style="display:inline-block;padding:13px 20px;color:${EMAIL_COLORS.primaryForeground};font-size:15px;font-weight:600;line-height:1;text-decoration:none">${safeActionLabel}</a>
                    </td>
                  </tr>
                </table>
                <div style="margin:0 0 24px;padding:16px;border-radius:10px;background:${EMAIL_COLORS.background};color:${EMAIL_COLORS.muted};font-size:12px;line-height:1.55;overflow-wrap:anywhere">
                  Se o botão não funcionar, copie e cole este endereço no navegador:<br>
                  <a href="${safeHref}" style="color:${EMAIL_COLORS.primary};text-decoration:underline">${safeHref}</a>
                </div>
                <div style="border-top:1px solid ${EMAIL_COLORS.border};padding-top:20px;color:${EMAIL_COLORS.muted};font-size:13px;line-height:1.6">${footerHtml}</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 12px 0;color:${EMAIL_COLORS.muted};font-size:12px;line-height:1.5">
                ${APP_NAME} · Sua base pessoal de aprendizagem
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};
