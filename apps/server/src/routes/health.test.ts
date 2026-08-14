import { afterAll, describe, expect, it } from "vitest";

import { APP_NAME } from "@lazuli/shared";

import { buildApp } from "../app.ts";
import type { ServerEnv } from "../config.ts";

const testEnv: ServerEnv = {
  CORS_ORIGIN: "http://localhost:3000",
  LOG_LEVEL: "fatal",
  LOG_PRETTY: false,
  SERVER_HOST: "127.0.0.1",
  SERVER_PORT: 3001,
};

const app = buildApp(testEnv);

afterAll(async () => {
  await app.close();
});

describe("healthRoutes", () => {
  it("identifies the API and reports availability", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      appName: APP_NAME,
      status: "ok",
      timestamp: expect.any(String),
    });
  });
});
