import { beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth/minimal";
import { CURRENT_TERMS, CURRENT_PRIVACY } from "@lazuli/shared/legal/documents";
import { createAuth } from "../auth/auth.ts";
import { parseServerEnv } from "../config-schema.ts";
import type { Database } from "../database/client.ts";
import type { FastifyBaseLogger } from "fastify";

const effects = vi.hoisted(() => ({
  initializeNewUser: vi.fn(),
  recordLegalAcceptance: vi.fn(),
  enqueueLifecycleEmail: vi.fn(),
}));
vi.mock("better-auth/minimal", () => ({ betterAuth: vi.fn((options) => options) }));
vi.mock("../onboarding/onboarding-content.ts", () => ({
  initializeNewUser: effects.initializeNewUser,
}));
vi.mock("../email/email-outbox.ts", () => ({
  enqueueLifecycleEmail: effects.enqueueLifecycleEmail,
}));
vi.mock("./legal-service.ts", async (original) => ({
  ...(await original<typeof import("./legal-service.ts")>()),
  recordLegalAcceptance: effects.recordLegalAcceptance,
}));
const env = parseServerEnv({
  AUTH_EMAIL_FROM: "Lazúli <onboarding@resend.dev>",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:55432/lazuli_test",
  RESEND_API_KEY: "re_test",
  WEBSITE_URL: "http://localhost:3000",
});
const user = {
  id: "user-1",
  name: "Ana Silva",
  email: "ana@example.com",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
beforeEach(() => {
  vi.clearAllMocks();
  createAuth(env, {} as Database, {} as FastifyBaseLogger);
});

describe("email and OAuth contract lifecycle", () => {
  const hooks = () => vi.mocked(betterAuth).mock.calls[0]![0].databaseHooks!.user!.create!;
  it.each([
    undefined,
    {
      accepted: false,
      termsVersion: CURRENT_TERMS.version,
      privacyVersion: CURRENT_PRIVACY.version,
    },
    { accepted: true, termsVersion: "old", privacyVersion: CURRENT_PRIVACY.version },
  ])("rejects email signup without valid explicit agreement", async (legalAcceptance) => {
    const before = hooks().before!;
    const context = { path: "/sign-up/email", body: { legalAcceptance } } as NonNullable<
      Parameters<typeof before>[1]
    >;
    await expect(before(user, context)).rejects.toMatchObject({
      body: { code: "LEGAL_ACCEPTANCE_REQUIRED" },
    });
  });
  it("validates the submitted editions and records the server-controlled signup channel", async () => {
    const before = hooks().before!;
    const context = {
      path: "/sign-up/email",
      body: {
        legalAcceptance: {
          accepted: true,
          termsVersion: CURRENT_TERMS.version,
          privacyVersion: CURRENT_PRIVACY.version,
        },
      },
    } as NonNullable<Parameters<typeof before>[1]>;
    await expect(before(user, context)).resolves.toMatchObject({ data: { name: "Ana Silva" } });
    await hooks().after!(user, context);
    expect(effects.recordLegalAcceptance).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "email-registration",
    );
    expect(effects.enqueueLifecycleEmail).toHaveBeenCalledOnce();
  });
  it("does not treat Google authentication or a callback flag as acceptance", async () => {
    const after = hooks().after!;
    const context = {
      path: "/callback/google",
      body: { legalAcceptance: { accepted: true } },
    } as NonNullable<Parameters<typeof after>[1]>;
    await after(user, context);
    expect(effects.initializeNewUser).toHaveBeenCalledOnce();
    expect(effects.recordLegalAcceptance).not.toHaveBeenCalled();
    expect(effects.enqueueLifecycleEmail).not.toHaveBeenCalled();
  });
});
