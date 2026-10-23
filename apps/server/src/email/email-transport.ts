import { Resend } from "resend";
import type { ServerEnv } from "../config.ts";

export type EmailMessage = {
  subject: string;
  html: string;
  text: string;
  attachments?: { content: Buffer; contentType: string; filename: string }[];
};

export const createEmailTransport = (env: ServerEnv) => {
  const resend = new Resend(env.RESEND_API_KEY);
  return async ({
    to,
    idempotencyKey,
    message,
  }: {
    to: string;
    idempotencyKey: string;
    message: EmailMessage;
  }) => {
    const result = await resend.emails.send(
      { from: env.AUTH_EMAIL_FROM, to, ...message },
      { idempotencyKey },
    );
    if (result.error) throw new Error(`Email delivery rejected: ${result.error.name}`);
    if (!result.data?.id) throw new Error("Email delivery returned no identifier");
    return result.data.id;
  };
};
