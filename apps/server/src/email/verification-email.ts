import { APP_NAME } from "@lazuli/shared";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const createVerificationEmail = ({ name, url }: { name: string; url: string }) => {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);

  return {
    subject: `Confirme seu e-mail no ${APP_NAME}`,
    text: `Olá, ${name}. Confirme seu e-mail para começar a usar o ${APP_NAME}: ${url}\n\nSe você não criou esta conta, ignore esta mensagem.`,
    html: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f5f2eb;color:#24211e;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px">
      <p style="margin:0 0 32px;color:#284f87;font-family:Georgia,serif;font-size:28px;font-weight:600">${APP_NAME}</p>
      <div style="border:1px solid #d7d0c4;background:#fffdf8;padding:36px">
        <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:32px;font-weight:500;line-height:1.1">Confirme seu e-mail</h1>
        <p style="margin:0 0 24px;line-height:1.6">Olá, ${safeName}. Confirme seu endereço para começar a organizar seus estudos.</p>
        <a href="${safeUrl}" style="display:inline-block;background:#284f87;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:600">Confirmar e-mail</a>
        <p style="margin:28px 0 0;color:#6f685e;font-size:13px;line-height:1.6">Este link expira em uma hora. Se você não criou esta conta, ignore esta mensagem.</p>
      </div>
    </div>
  </body>
</html>`,
  };
};
