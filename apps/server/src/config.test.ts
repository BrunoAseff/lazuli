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
});
