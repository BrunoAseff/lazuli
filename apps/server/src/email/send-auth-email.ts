import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { Resend } from "resend";

import type { ServerEnv } from "../config.ts";

type AuthEmailData = {
  email: string;
  name: string;
  token: string;
  url: string;
};

type AuthEmailMessage = {
  html: string;
  subject: string;
  text: string;
};

const maskEmail = (email: string) => {
  const [localPart = "", domain = ""] = email.split("@");
  return `${localPart.slice(0, 1)}***@${domain}`;
};

export const createAuthEmailSender = (
  env: ServerEnv,
  logger: FastifyBaseLogger,
  options: {
    createMessage: (data: Pick<AuthEmailData, "name" | "url">) => AuthEmailMessage;
    idempotencyPrefix: string;
    logMessage: string;
  },
) => {
  const resend = new Resend(env.RESEND_API_KEY);

  return async ({ email, name, token, url }: AuthEmailData) => {
    const message = options.createMessage({ name, url });
    const operationId = createHash("sha256").update(token).digest("hex").slice(0, 32);
    const { error } = await resend.emails.send(
      {
        from: env.AUTH_EMAIL_FROM,
        to: email,
        ...message,
      },
      { idempotencyKey: `${options.idempotencyPrefix}/${operationId}` },
    );

    if (error) {
      throw new Error(`Resend rejected authentication email: ${error.name}`);
    }

    logger.info({ email: maskEmail(email) }, options.logMessage);
  };
};
