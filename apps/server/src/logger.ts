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

/**
 * One line per request with the route's pattern, never the URL: reset and verification links carry
 * their token in the path or query, and logs must not hold anything that opens an account.
 * (Fastify's own request logging is turned off for this reason.) Register as an onResponse hook.
 */
export const logRequest = async (
  request: {
    method: string;
    routeOptions: { url?: string };
    log: { info: (details: object, message: string) => void };
  },
  reply: { statusCode: number; elapsedTime: number },
) => {
  request.log.info(
    {
      method: request.method,
      route: request.routeOptions.url ?? "(sem rota)",
      statusCode: reply.statusCode,
      responseTime: Math.round(reply.elapsedTime),
    },
    "request completed",
  );
};
