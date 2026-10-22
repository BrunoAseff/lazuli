import type { FastifyBaseLogger } from "fastify";

import type { ServerEnv } from "../config.ts";
import { createChangeEmailConfirmation } from "./change-email-confirmation.ts";
import { createAuthEmailSender } from "./send-auth-email.ts";

export const createChangeEmailConfirmationSender = (env: ServerEnv, logger: FastifyBaseLogger) =>
  createAuthEmailSender(env, logger, {
    createMessage: createChangeEmailConfirmation,
    idempotencyPrefix: "change-email",
    logMessage: "change email confirmation sent",
  });
