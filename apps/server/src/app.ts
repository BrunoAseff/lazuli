import cors from "@fastify/cors";
import Fastify from "fastify";

import type { ServerEnv } from "./config.ts";
import { createLogger } from "./logger.ts";
import { healthRoutes } from "./routes/health.ts";

export const buildApp = (env: ServerEnv) => {
  const app = Fastify({
    loggerInstance: createLogger(env),
  });

  void app.register(cors, {
    credentials: true,
    origin: env.CORS_ORIGIN,
  });

  app.register(healthRoutes);

  return app;
};
