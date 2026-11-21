import { APP_NAME } from "@lazuli/shared";

/*
 * Every email shares one layout, on the app's identity: the paper page, a white sheet, ink text,
 * the serif for the title, the lapis action and the gem. Inline styles and tables only, so it
 * holds in Gmail, Outlook and Apple Mail.
 */

export const EMAIL_COLORS = {
  page: "#f3f4f6",
  sheet: "#ffffff",
  border: "#e1e3e8",
  ink: "#141a2e",
  muted: "#586074",
  lapis: "#2a40b4",
  lapisNight: "#0e1330",
  lapisLight: "#a9b8f5",
  pyrite: "#c9a14a",
  white: "#ffffff",
} as const;

const SANS = "'Manrope','Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "'Newsreader',Georgia,'Times New Roman',serif";

export const escapeEmailHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** A paragraph of the email body; `secondary` for supporting detail. Expects escaped HTML. */
export const emailParagraph = (html: string, options: { secondary?: boolean } = {}) =>
  `<p style="margin:0 0 14px;color:${options.secondary ? EMAIL_COLORS.muted : EMAIL_COLORS.ink};font-family:${SANS};font-size:${options.secondary ? 14 : 16}px;line-height:1.65">${html}</p>`;

/** The app icon (the gem on lapis night), served by the website; a drawn gem when there is none. */
const brandMark = (website?: string) => {
  if (website) {
    const src = escapeEmailHtml(new URL("/icon-192.png", website).toString());
    return `<img src="${src}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:0;border-radius:8px">`;
  }
  return `<div style="width:32px;height:32px;border-radius:8px;background:${EMAIL_COLORS.lapisNight};color:${EMAIL_COLORS.lapisLight};font-size:16px;line-height:32px;text-align:center">◆</div>`;
};

type TransactionalEmailOptions = {
  action?: {
    href: string;
    label: string;
  };
  childrenHtml: string;
  footerHtml: string;
  preheader: string;
  title: string;
  /** The validated WEBSITE_URL, where the app icon is served. */
  websiteUrl?: string;
};

export const createTransactionalEmailHtml = ({
  action,
  childrenHtml,
  footerHtml,
  preheader,
  title,
  websiteUrl,
}: TransactionalEmailOptions) => {
  const safeHref = action ? escapeEmailHtml(action.href) : null;
  const safeActionLabel = action ? escapeEmailHtml(action.label) : null;
  const safePreheader = escapeEmailHtml(preheader);
  const safeTitle = escapeEmailHtml(title);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_COLORS.page};color:${EMAIL_COLORS.ink};font-family:${SANS};-webkit-text-size-adjust:100%">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${EMAIL_COLORS.page}">
      <tr>
        <td align="center" style="padding:36px 16px 40px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px">
            <tr>
              <td style="padding:0 4px 22px">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="32" valign="middle">${brandMark(websiteUrl)}</td>
                    <td valign="middle" style="padding-left:10px;font-family:${SERIF};font-size:23px;font-weight:500;line-height:1;color:${EMAIL_COLORS.ink}">${APP_NAME}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid ${EMAIL_COLORS.border};border-radius:14px;background:${EMAIL_COLORS.sheet};padding:34px 30px 30px">
                <h1 style="margin:0 0 18px;font-family:${SERIF};font-size:28px;font-weight:500;line-height:1.2;color:${EMAIL_COLORS.ink}">${safeTitle}</h1>
                ${childrenHtml}
                ${
                  action
                    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 22px">
                  <tr>
                    <td bgcolor="${EMAIL_COLORS.lapis}" style="border-radius:10px;background:${EMAIL_COLORS.lapis}">
                      <a href="${safeHref}" style="display:inline-block;padding:13px 22px;color:${EMAIL_COLORS.white};font-family:${SANS};font-size:15px;font-weight:600;line-height:1;text-decoration:none">${safeActionLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 26px;color:${EMAIL_COLORS.muted};font-family:${SANS};font-size:12px;line-height:1.6;overflow-wrap:anywhere">
                  Se o botão não funcionar, copie e cole este endereço no navegador:<br>
                  <a href="${safeHref}" style="color:${EMAIL_COLORS.lapis};text-decoration:underline">${safeHref}</a>
                </p>`
                    : ""
                }
                <p style="margin:${action ? 0 : 12}px 0 0;color:${EMAIL_COLORS.muted};font-family:${SANS};font-size:13px;line-height:1.6">${footerHtml}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 12px 0;color:${EMAIL_COLORS.muted};font-family:${SANS};font-size:12px;line-height:1.5">
                <span style="color:${EMAIL_COLORS.pyrite}">◆</span>&nbsp; ${APP_NAME} · Organize seus estudos. Aprenda praticando.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};
