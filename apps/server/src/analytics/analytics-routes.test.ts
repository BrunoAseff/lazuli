import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createAnalyticsRoutes } from "./analytics-routes.ts";

const preferences = vi.hoisted(() => ({
  getAnalyticsPreference: vi.fn(),
  updateAnalyticsPreference: vi.fn(),
}));

vi.mock("./analytics-preferences.ts", () => preferences);

const apps: ReturnType<typeof Fastify>[] = [];
const database = {} as Database;
const session = {
  session: { id: "session-1" },
  user: { email: "ana@example.com", id: "user-1", name: "Ana" },
};

const auth = (value: typeof session | null) =>
  ({ api: { getSession: vi.fn().mockResolvedValue(value) } }) as unknown as Auth;

const register = async (sessionValue: typeof session | null = session) => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createAnalyticsRoutes({
      auth: auth(sessionValue),
      database,
      websiteUrl: "http://localhost:3000",
    }),
  );
  return app;
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("analytics preference routes", () => {
  it("requires authentication before reading a preference", async () => {
    const app = await register(null);

    const response = await app.inject({ method: "GET", url: "/api/analytics/preferences" });

    expect(response.statusCode).toBe(401);
    expect(preferences.getAnalyticsPreference).not.toHaveBeenCalled();
  });

  it("rejects cross-origin preference mutations", async () => {
    const app = await register();

    const response = await app.inject({
      headers: { origin: "https://evil.example" },
      method: "PUT",
      payload: { status: "granted" },
      url: "/api/analytics/preferences",
    });

    expect(response.statusCode).toBe(403);
    expect(preferences.updateAnalyticsPreference).not.toHaveBeenCalled();
  });

  it("persists only a valid decision for the authenticated account", async () => {
    preferences.updateAnalyticsPreference.mockResolvedValue({
      decidedAt: "2026-10-20T12:00:00.000Z",
      status: "granted",
      version: 1,
    });
    const app = await register();

    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "PUT",
      payload: { status: "granted" },
      url: "/api/analytics/preferences",
    });

    expect(response.statusCode).toBe(200);
    expect(preferences.updateAnalyticsPreference).toHaveBeenCalledWith(database, "user-1", {
      status: "granted",
    });
  });
});
