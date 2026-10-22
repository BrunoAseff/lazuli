import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { Resend } from "resend";

import type { ServerEnv } from "../config.ts";
import { createAccountExportEmail } from "./account-export-email.ts";

export const createAccountExportEmailSender = (env: ServerEnv, logger: FastifyBaseLogger) => {
  const resend = new Resend(env.RESEND_API_KEY);
  return async ({
    attachment,
    email,
    exportId,
    filename,
    name,
  }: {
    attachment: Buffer;
    email: string;
    exportId: string;
    filename: string;
    name: string;
  }) => {
    const message = createAccountExportEmail({ name });
    const { error } = await resend.emails.send(
      {
        attachments: [{ content: attachment, contentType: "application/zip", filename }],
        from: env.AUTH_EMAIL_FROM,
        to: email,
        ...message,
      },
      {
        idempotencyKey: `account-export/${createHash("sha256").update(exportId).digest("hex").slice(0, 32)}`,
      },
    );
    if (error) throw new Error(`Resend rejected account export email: ${error.name}`);
    logger.info({ exportId }, "account export email sent");
  };
};
