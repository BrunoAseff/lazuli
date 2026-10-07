import type { FastifyBaseLogger } from "fastify";

import type { ServerEnv } from "../config.ts";
import { createAuthEmailSender } from "./send-auth-email.ts";
import { createVerificationEmail } from "./verification-email.ts";

export const createVerificationEmailSender = (env: ServerEnv, logger: FastifyBaseLogger) =>
  createAuthEmailSender(env, logger, {
    createMessage: createVerificationEmail,
    idempotencyPrefix: "verify-email",
    logMessage: "verification email sent",
  });
