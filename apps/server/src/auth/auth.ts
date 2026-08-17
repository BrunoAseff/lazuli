import type { FastifyBaseLogger } from "fastify";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import type { ServerEnv } from "../config.ts";
import type { Database } from "../database/client.ts";
import * as schema from "../database/schema/index.ts";
import { createVerificationEmailSender } from "../email/send-verification-email.ts";
import { isValidAccountName, normalizeAccountName } from "./account-name.ts";

export const createAuth = (env: ServerEnv, database: Database, logger: FastifyBaseLogger) => {
  const sendVerificationEmail = createVerificationEmailSender(env, logger);

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
      },
    },
    emailAndPassword: {
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 8,
      requireEmailVerification: true,
    },
    emailVerification: {
      autoSignInAfterVerification: false,
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
    rateLimit: {
      enabled: true,
      max: 20,
      window: 60,
    },
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEBSITE_URL],
  });
};

export type Auth = ReturnType<typeof createAuth>;
