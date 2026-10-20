import type { FastifyBaseLogger } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseServerEnv } from "../config-schema.ts";
import type { Database } from "../database/client.ts";
import { createAnalyticsService } from "./analytics-service.ts";

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  create: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined),
}));
const preferences = vi.hoisted(() => ({ getAnalyticsPreference: vi.fn() }));

vi.mock("posthog-node", () => ({
  PostHog: class {
    capture = posthog.capture;
    shutdown = posthog.shutdown;

    constructor(...args: unknown[]) {
      posthog.create(...args);
    }
  },
}));
vi.mock("./analytics-preferences.ts", () => preferences);

const database = {} as Database;
const logger = { warn: vi.fn() } as unknown as FastifyBaseLogger;
const productionEnvironment = parseServerEnv({
  ANALYTICS_ENABLED: "true",
  AUTH_EMAIL_FROM: "Lazúli <onboarding@resend.dev>",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "https://api.example.com",
  DATABASE_URL: "postgresql://postgres:postgres@example.com:5432/lazuli",
  NODE_ENV: "production",
  POSTHOG_API_KEY: "phc_test",
  RESEND_API_KEY: "re_test",
  WEBSITE_URL: "https://app.example.com",
});

afterEach(() => vi.clearAllMocks());

describe("analytics service", () => {
  it("does not initialize PostHog outside production", () => {
    createAnalyticsService({ ...productionEnvironment, NODE_ENV: "test" }, database, logger);

    expect(posthog.create).not.toHaveBeenCalled();
  });

  it("captures only allowlisted properties after explicit consent", async () => {
    preferences.getAnalyticsPreference.mockResolvedValue({
      decidedAt: "2026-10-20T12:00:00.000Z",
      status: "granted",
      version: 1,
    });
    const analytics = createAnalyticsService(productionEnvironment, database, logger);

    await analytics.capture("user-1", "project_created", {});

    expect(posthog.capture).toHaveBeenCalledWith({
      disableGeoip: true,
      distinctId: "user-1",
      event: "project_created",
      properties: { $process_person_profile: false },
    });
  });

  it("drops events when consent is absent or revoked", async () => {
    preferences.getAnalyticsPreference.mockResolvedValue({
      decidedAt: null,
      status: "undecided",
      version: 1,
    });
    const analytics = createAnalyticsService(productionEnvironment, database, logger);

    await analytics.capture("user-1", "project_created", {});

    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("rejects undeclared properties before they reach PostHog", async () => {
    preferences.getAnalyticsPreference.mockResolvedValue({
      decidedAt: "2026-10-20T12:00:00.000Z",
      status: "granted",
      version: 1,
    });
    const analytics = createAnalyticsService(productionEnvironment, database, logger);

    await analytics.capture("user-1", "project_created", {
      title: "conteúdo privado",
    } as never);

    expect(posthog.capture).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "project_created" }),
      "analytics capture failed",
    );
  });

  it("flushes the shared client during shutdown", async () => {
    const analytics = createAnalyticsService(productionEnvironment, database, logger);

    await analytics.shutdown();

    expect(posthog.shutdown).toHaveBeenCalledOnce();
  });
});
