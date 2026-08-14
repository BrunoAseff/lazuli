import type { FastifyPluginAsync } from "fastify";

import { APP_NAME, type ApiHealthResponse } from "@lazuli/shared";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/health", async () => {
    const payload: ApiHealthResponse = {
      appName: APP_NAME,
      status: "ok",
      timestamp: new Date().toISOString(),
    };

    return payload;
  });
};
