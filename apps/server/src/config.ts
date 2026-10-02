import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const serverEnvSchema = z
  .object({
    AI_GENERATION_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(45_000),
    AI_MODEL: z.literal("gpt-6-luna").default("gpt-6-luna"),
    AI_REAL_CALLS_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AUTH_EMAIL_FROM: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    DATABASE_URL: z.url(),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("debug"),
    LOG_PRETTY: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    OPENAI_API_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    RESEND_API_KEY: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1).default("lazuli"),
    S3_BUCKET: z.string().min(1).default("lazuli-assets"),
    S3_ENDPOINT: z.url().default("http://localhost:59000"),
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_SECRET_ACCESS_KEY: z.string().min(1).default("lazuli-local-secret"),
    SERVER_HOST: z.string().default("0.0.0.0"),
    SERVER_PORT: z.coerce.number().int().positive().default(3001),
    WEBSITE_URL: z.url(),
  })
  .superRefine((env, context) => {
    if (env.AI_REAL_CALLS_ENABLED && !env.OPENAI_API_KEY)
      context.addIssue({
        code: "custom",
        message: "OPENAI_API_KEY is required when AI_REAL_CALLS_ENABLED=true",
        path: ["OPENAI_API_KEY"],
      });
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const serverEnv = serverEnvSchema.parse(process.env);
