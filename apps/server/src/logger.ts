import pino from "pino";

import type { ServerEnv } from "./config.ts";

export const createLogger = (env: ServerEnv) =>
  pino({
    level: env.LOG_LEVEL,
    transport: env.LOG_PRETTY
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "SYS:standard",
          },
        }
      : undefined,
  });
