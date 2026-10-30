import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CURRENT_TERMS, CURRENT_PRIVACY } from "@lazuli/shared/legal/documents";
import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createLegalRoutes } from "./legal-routes.ts";
import { createLegalAccessGuard } from "./legal-access.ts";
import { requireSession } from "../auth/require-session.ts";

const service = vi.hoisted(() => ({ getLegalStatus: vi.fn(), recordLegalAcceptance: vi.fn() }));
vi.mock("./legal-service.ts", async (original) => ({
  ...(await original<typeof import("./legal-service.ts")>()),
  ...service,
}));
const apps: ReturnType<typeof Fastify>[] = [];
const database = {} as Database;
const session = { session: { id: "session-1" }, user: { id: "user-1" } };
const input = {
  accepted: true,
  termsVersion: CURRENT_TERMS.version,
  privacyVersion: CURRENT_PRIVACY.version,
};
const state = {
  accepted: false,
  acceptedAt: null,
  termsVersion: CURRENT_TERMS.version,
  privacyVersion: CURRENT_PRIVACY.version,
};
const setup = async (authenticated = true) => {
  const app = Fastify();
  apps.push(app);
  const auth = {
    api: { getSession: vi.fn().mockResolvedValue(authenticated ? session : null) },
  } as unknown as Auth;
  const lookup = vi.fn().mockResolvedValue(state);
  app.addHook("preHandler", createLegalAccessGuard(auth, lookup));
  await app.register(createLegalRoutes({ auth, database, websiteUrl: "http://localhost:3000" }));
  const handler = vi.fn().mockResolvedValue({ success: true });
  app.get("/api/documents", async (request, reply) => {
    await requireSession(auth, request, reply);
    return handler();
  });
  app.post("/api/billing/checkout-sessions", handler);
  app.post("/api/billing/webhooks/stripe", handler);
  app.post("/api/billing/portal-sessions", handler);
  app.post("/api/account-exports", handler);
  app.delete("/api/account", handler);
  app.get("/api/health", handler);
  return { app, lookup, auth, handler };
};
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.clearAllMocks();
});

describe("contract enforcement", () => {
  it("blocks material access and checkout without acceptance", async () => {
    const { app, handler } = await setup();
    expect((await app.inject("/api/documents")).json().code).toBe("LEGAL_ACCEPTANCE_REQUIRED");
    expect(
      (await app.inject({ method: "POST", url: "/api/billing/checkout-sessions" })).statusCode,
    ).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("does not look up agreement for an unauthenticated account", async () => {
    const { app, lookup } = await setup(false);
    expect((await app.inject("/api/documents")).statusCode).toBe(401);
    expect(lookup).not.toHaveBeenCalled();
  });
  it("shares session verification between the guard and protected handler", async () => {
    const { app, auth, lookup } = await setup();
    lookup.mockResolvedValue({ ...state, accepted: true });
    expect((await app.inject("/api/documents")).statusCode).toBe(200);
    expect(auth.api.getSession).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith("user-1");
  });
  it.each([
    ["POST", "/api/account-exports"],
    ["DELETE", "/api/account"],
    ["POST", "/api/billing/portal-sessions"],
    ["POST", "/api/billing/webhooks/stripe"],
    ["GET", "/api/health"],
  ] as const)("keeps %s %s outside the acceptance gate", async (method, url) => {
    const { app, lookup } = await setup();
    expect((await app.inject({ method, url })).statusCode).toBe(200);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("acceptance endpoint", () => {
  it("uses the authenticated identity and exposes private, uncached status", async () => {
    service.getLegalStatus.mockResolvedValue(state);
    const { app } = await setup();
    const response = await app.inject("/api/legal/status");
    expect(response.json()).toEqual(state);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(service.getLegalStatus).toHaveBeenCalledWith(database, "user-1");
  });
  it("requires authentication even on essential legal routes", async () => {
    const { app } = await setup(false);
    expect((await app.inject("/api/legal/status")).statusCode).toBe(401);
    expect(service.getLegalStatus).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { ...input, accepted: false },
    { ...input, userId: "another-user" },
    { ...input, acceptedAt: "yesterday" },
  ])("rejects missing agreement or forged evidence: %j", async (payload) => {
    const { app } = await setup();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/legal/acceptance",
          headers: { origin: "http://localhost:3000" },
          payload,
        })
      ).statusCode,
    ).toBe(400);
    expect(service.recordLegalAcceptance).not.toHaveBeenCalled();
  });
  it("rejects obsolete editions and cross-origin requests", async () => {
    const { app } = await setup();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/legal/acceptance",
          headers: { origin: "http://localhost:3000" },
          payload: { ...input, termsVersion: "old" },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/legal/acceptance",
          headers: { origin: "https://evil.example" },
          payload: input,
        })
      ).statusCode,
    ).toBe(403);
    expect(service.recordLegalAcceptance).not.toHaveBeenCalled();
  });
  it("records the account-gate channel only after explicit confirmation", async () => {
    const saved = { ...state, accepted: true, acceptedAt: "2026-10-29T12:00:00.000Z" };
    service.recordLegalAcceptance.mockResolvedValue(saved);
    const { app } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/api/legal/acceptance",
      headers: { origin: "http://localhost:3000" },
      payload: input,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(saved);
    expect(service.recordLegalAcceptance).toHaveBeenCalledWith(database, "user-1", "account-gate");
  });
});
