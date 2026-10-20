import { describe, expect, it } from "vitest";

import { getServerPort, parseServerEnv } from "./config-schema.ts";

const validEnvironment = {
  AUTH_EMAIL_FROM: "Lazúli <onboarding@resend.dev>",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:55432/lazuli_test",
  RESEND_API_KEY: "re_test",
  WEBSITE_URL: "http://localhost:3000",
};

describe("server environment", () => {
  it("keeps safe local defaults for proxy and S3 behavior", () => {
    const environment = parseServerEnv(validEnvironment);

    expect(environment.TRUST_PROXY).toBe(false);
    expect(environment.S3_FORCE_PATH_STYLE).toBe(true);
    expect(environment.S3_CREATE_BUCKET_IF_MISSING).toBe(true);
    expect(environment.COMMERCIAL_LIMITS_ENFORCED).toBe(false);
    expect(environment.ANALYTICS_ENABLED).toBe(false);
  });

  it("enables commercial limit enforcement independently from Stripe billing", () => {
    expect(
      parseServerEnv({ ...validEnvironment, COMMERCIAL_LIMITS_ENFORCED: "true" })
        .COMMERCIAL_LIMITS_ENFORCED,
    ).toBe(true);
  });

  it("parses production proxy and S3 settings", () => {
    const environment = parseServerEnv({
      ...validEnvironment,
      S3_CREATE_BUCKET_IF_MISSING: "false",
      S3_FORCE_PATH_STYLE: "false",
      TRUST_PROXY: "1",
    });

    expect(environment.TRUST_PROXY).toBe(1);
    expect(environment.S3_FORCE_PATH_STYLE).toBe(false);
    expect(environment.S3_CREATE_BUCKET_IF_MISSING).toBe(false);
  });

  it("gives Railway PORT precedence over the local server port", () => {
    const environment = parseServerEnv({
      ...validEnvironment,
      PORT: "8080",
      SERVER_PORT: "3001",
    });

    expect(getServerPort(environment)).toBe(8080);
  });

  it("rejects unrestricted or malformed proxy values", () => {
    expect(() => parseServerEnv({ ...validEnvironment, TRUST_PROXY: "true" })).toThrow(
      "TRUST_PROXY",
    );
  });

  it("requires every Stripe identifier only when billing is enabled", () => {
    expect(() => parseServerEnv({ ...validEnvironment, BILLING_ENABLED: "true" })).toThrow(
      "STRIPE_SECRET_KEY",
    );

    expect(
      parseServerEnv({
        ...validEnvironment,
        BILLING_ENABLED: "true",
        STRIPE_ESSENTIAL_PRICE_ID: "price_essential",
        STRIPE_SECRET_KEY: "sk_test_example",
        STRIPE_SPECIALIST_PRICE_ID: "price_specialist",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
      }).BILLING_ENABLED,
    ).toBe(true);
  });

  it("treats empty Stripe variables as unset while billing is disabled", () => {
    const environment = parseServerEnv({
      ...validEnvironment,
      STRIPE_ESSENTIAL_PRICE_ID: "",
      STRIPE_SECRET_KEY: "",
      STRIPE_SPECIALIST_PRICE_ID: "",
      STRIPE_WEBHOOK_SECRET: "",
    });

    expect(environment.STRIPE_ESSENTIAL_PRICE_ID).toBeUndefined();
    expect(environment.STRIPE_SECRET_KEY).toBeUndefined();
    expect(environment.STRIPE_SPECIALIST_PRICE_ID).toBeUndefined();
    expect(environment.STRIPE_WEBHOOK_SECRET).toBeUndefined();
  });

  it("treats an empty PostHog key as unset while analytics is disabled", () => {
    const environment = parseServerEnv({ ...validEnvironment, POSTHOG_API_KEY: "" });
    expect(environment.POSTHOG_API_KEY).toBeUndefined();
  });

  it("requires a PostHog key only when analytics is enabled", () => {
    expect(() => parseServerEnv({ ...validEnvironment, ANALYTICS_ENABLED: "true" })).toThrow(
      "POSTHOG_API_KEY",
    );
    expect(
      parseServerEnv({
        ...validEnvironment,
        ANALYTICS_ENABLED: "true",
        POSTHOG_API_KEY: "phc_test",
      }).ANALYTICS_ENABLED,
    ).toBe(true);
  });
});
