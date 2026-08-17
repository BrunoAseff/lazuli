import { afterAll, describe, expect, it } from "vitest";

import { APP_NAME } from "@lazuli/shared";

import { buildApp } from "../app.ts";
import type { ServerEnv } from "../config.ts";

const testEnv: ServerEnv = {
  AUTH_EMAIL_FROM: "Lazúli <onboarding@resend.dev>",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:55432/lazuli_test",
  LOG_LEVEL: "fatal",
  LOG_PRETTY: false,
  NODE_ENV: "test",
  RESEND_API_KEY: "re_test",
  SERVER_HOST: "127.0.0.1",
  SERVER_PORT: 3001,
  WEBSITE_URL: "http://localhost:3000",
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
