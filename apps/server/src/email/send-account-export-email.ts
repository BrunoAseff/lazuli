import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { createEmailTransport } from "./email-transport.ts";

import type { ServerEnv } from "../config.ts";
import { createAccountExportEmail } from "./account-export-email.ts";

export const createAccountExportEmailSender = (env: ServerEnv, logger: FastifyBaseLogger) => {
  const send = createEmailTransport(env);
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
    await send({
      to: email,
      message: {
        ...message,
        attachments: [{ content: attachment, contentType: "application/zip", filename }],
      },
      idempotencyKey: `account-export/${createHash("sha256").update(exportId).digest("hex").slice(0, 32)}`,
    });
    logger.info({ exportId }, "account export email sent");
  };
};
