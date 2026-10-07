import type { FastifyBaseLogger } from "fastify";

import type { ServerEnv } from "../config.ts";
import { createPasswordResetEmail } from "./password-reset-email.ts";
import { createAuthEmailSender } from "./send-auth-email.ts";

export const createPasswordResetEmailSender = (env: ServerEnv, logger: FastifyBaseLogger) =>
  createAuthEmailSender(env, logger, {
    createMessage: createPasswordResetEmail,
    idempotencyPrefix: "reset-password",
    logMessage: "password reset email sent",
  });
