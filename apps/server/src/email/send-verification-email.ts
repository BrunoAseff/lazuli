import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { Resend } from "resend";

import type { ServerEnv } from "../config.ts";
import { createVerificationEmail } from "./verification-email.ts";

const maskEmail = (email: string) => {
  const [localPart = "", domain = ""] = email.split("@");
  return `${localPart.slice(0, 1)}***@${domain}`;
};

export const createVerificationEmailSender = (env: ServerEnv, logger: FastifyBaseLogger) => {
  const resend = new Resend(env.RESEND_API_KEY);

  return async ({
    email,
    name,
    token,
    url,
  }: {
    email: string;
    name: string;
    token: string;
    url: string;
  }) => {
    const message = createVerificationEmail({ name, url });
    const operationId = createHash("sha256").update(token).digest("hex").slice(0, 32);
    const { error } = await resend.emails.send(
      {
        from: env.AUTH_EMAIL_FROM,
        to: email,
        ...message,
      },
      { idempotencyKey: `verify-email/${operationId}` },
    );

    if (error) {
      throw new Error(`Resend rejected verification email: ${error.name}`);
    }

    logger.info({ email: maskEmail(email) }, "verification email sent");
  };
};
