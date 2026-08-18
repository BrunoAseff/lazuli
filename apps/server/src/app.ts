import cors from "@fastify/cors";
import Fastify from "fastify";

import type { ServerEnv } from "./config.ts";
import { createAuth } from "./auth/auth.ts";
import { createDatabase } from "./database/client.ts";
import { createLogger } from "./logger.ts";
import { createProjectRoutes } from "./projects/project-routes.ts";
import { createAuthRoutes } from "./routes/auth-routes.ts";
import { healthRoutes } from "./routes/health.ts";

export const buildApp = (env: ServerEnv) => {
  const app = Fastify({
    loggerInstance: createLogger(env),
  });
  const database = createDatabase(env.DATABASE_URL);
  const auth = createAuth(env, database.db, app.log);

  void app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    origin: env.WEBSITE_URL,
  });

  app.register(createAuthRoutes(auth, env));
  app.register(createProjectRoutes({ auth, database: database.db, websiteUrl: env.WEBSITE_URL }));
  app.register(healthRoutes);

  app.addHook("onClose", async () => {
    await database.client.end({ timeout: 1 });
  });

  return app;
};
