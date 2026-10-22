import type { FastifyBaseLogger } from "fastify";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_EMAIL_COOLDOWN_SECONDS,
  VERIFICATION_EMAIL_COOLDOWN_SECONDS,
} from "@lazuli/shared";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import type { ServerEnv } from "../config.ts";
import type { Database } from "../database/client.ts";
import * as schema from "../database/schema/index.ts";
import { createVerificationEmailSender } from "../email/send-verification-email.ts";
import { createPasswordResetEmailSender } from "../email/send-password-reset-email.ts";
import { createChangeEmailConfirmationSender } from "../email/send-change-email-confirmation.ts";
import { initializeNewUser } from "../onboarding/onboarding-content.ts";
import { isValidAccountName, normalizeAccountName } from "./account-name.ts";

type AuthLifecycle = {
  afterDelete?: (user: { id: string }) => Promise<void>;
  beforeDelete?: (user: { id: string }) => Promise<void>;
};

export const createAuth = (
  env: ServerEnv,
  database: Database,
  logger: FastifyBaseLogger,
  lifecycle: AuthLifecycle = {},
) => {
  const sendVerificationEmail = createVerificationEmailSender(env, logger);
  const sendPasswordResetEmail = createPasswordResetEmailSender(env, logger);
  const sendChangeEmailConfirmation = createChangeEmailConfirmationSender(env, logger);
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  return betterAuth({
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-lazuli-client-ip"],
      },
    },
    appName: "Lazúli",
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await initializeNewUser(database, user.id);
          },
          before: async (user) => {
            const name = normalizeAccountName(user.name);

            if (!isValidAccountName(name)) {
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_NAME",
                message: "Name must contain between 2 and 80 characters.",
              });
            }

            return { data: { ...user, name } };
          },
        },
        update: {
          before: async (user) => {
            if (user.name === undefined) return;
            const name = normalizeAccountName(user.name);
            if (!isValidAccountName(name))
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_NAME",
                message: "Name must contain between 2 and 80 characters.",
              });
            return { data: { ...user, name } };
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      maxPasswordLength: AUTH_PASSWORD_MAX_LENGTH,
      minPasswordLength: AUTH_PASSWORD_MIN_LENGTH,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ token, url, user }) => {
        void sendPasswordResetEmail({
          email: user.email,
          name: user.name,
          token,
          url,
        }).catch((error: unknown) => {
          logger.error({ err: error, userId: user.id }, "password reset email failed");
        });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ token, url, user }) => {
        void sendVerificationEmail({
          email: user.email,
          name: user.name,
          token,
          url,
        }).catch((error: unknown) => {
          logger.error({ err: error, userId: user.id }, "verification email failed");
        });
      },
    },
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
        enabled: true,
        requireLocalEmailVerified: true,
        trustedProviders: googleConfigured ? ["google"] : [],
      },
    },
    rateLimit: {
      customRules: {
        "/request-password-reset": {
          max: 1,
          window: PASSWORD_RESET_EMAIL_COOLDOWN_SECONDS,
        },
        "/send-verification-email": {
          max: 1,
          window: VERIFICATION_EMAIL_COOLDOWN_SECONDS,
        },
      },
      enabled: true,
      max: 20,
      window: 60,
    },
    secret: env.BETTER_AUTH_SECRET,
    session: { freshAge: 15 * 60 },
    socialProviders: googleConfigured
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    trustedOrigins: [env.WEBSITE_URL],
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ token, url, user }) => {
          await sendChangeEmailConfirmation({
            email: user.email,
            name: user.name,
            token,
            url,
          });
        },
      },
      deleteUser: {
        enabled: true,
        afterDelete: lifecycle.afterDelete,
        beforeDelete: lifecycle.beforeDelete,
      },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;
