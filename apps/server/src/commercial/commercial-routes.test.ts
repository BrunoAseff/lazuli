import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createCommercialRoutes } from "./commercial-routes.ts";
import type { StripeBillingService } from "./stripe-billing-service.ts";

const commercialService = vi.hoisted(() => ({ getCommercialSummary: vi.fn() }));

vi.mock("./commercial-service.ts", () => commercialService);

const apps: ReturnType<typeof Fastify>[] = [];
const database = {} as Database;
const verifiedSession = {
  session: { id: "session-1" },
  user: { id: "user-1", email: "ana@example.com", name: "Ana" },
};

const createAuth = (session: typeof verifiedSession | null) =>
  ({ api: { getSession: vi.fn().mockResolvedValue(session) } }) as unknown as Auth;

const createStripe = () => {
  const spies = {
    constructEvent: vi.fn(),
    createCheckout: vi.fn(),
    createPortal: vi.fn(),
    enqueueEvent: vi.fn(),
    processEvent: vi.fn(),
  };
  return { ...spies, service: spies as unknown as StripeBillingService };
};

const registerRoutes = async ({
  auth = createAuth(verifiedSession),
  stripe = createStripe().service,
}: {
  auth?: Auth;
  stripe?: StripeBillingService | null;
} = {}) => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createCommercialRoutes({ auth, database, stripe, websiteUrl: "http://localhost:3000" }),
  );
  return app;
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("commercial routes", () => {
  it("exposes the ordered public plan catalog", async () => {
    const app = await registerRoutes({ auth: createAuth(null) });
    const response = await app.inject({ method: "GET", url: "/api/billing/plans" });

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((item: { code: string }) => item.code)).toEqual([
      "basic",
      "essential",
      "specialist",
    ]);
  });

  it("requires a session for the commercial summary", async () => {
    const app = await registerRoutes({ auth: createAuth(null) });
    const response = await app.inject({ method: "GET", url: "/api/billing/summary" });

    expect(response.statusCode).toBe(401);
    expect(commercialService.getCommercialSummary).not.toHaveBeenCalled();
  });

  it("delegates checkout to Stripe for a paid plan", async () => {
    const stripe = createStripe();
    stripe.createCheckout.mockResolvedValue({
      destination: "checkout",
      url: "https://checkout.stripe.test/session",
    });
    const app = await registerRoutes({ stripe: stripe.service });
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: { plan: "essential" },
      url: "/api/billing/checkout-sessions",
    });

    expect(response.statusCode).toBe(200);
    expect(stripe.createCheckout).toHaveBeenCalledWith("user-1", "essential");
    expect(response.json()).toEqual({
      destination: "checkout",
      url: "https://checkout.stripe.test/session",
    });
  });

  it("rejects free-plan checkout before calling Stripe", async () => {
    const stripe = createStripe();
    const app = await registerRoutes({ stripe: stripe.service });
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: { plan: "basic" },
      url: "/api/billing/checkout-sessions",
    });

    expect(response.statusCode).toBe(400);
    expect(stripe.createCheckout).not.toHaveBeenCalled();
  });

  it("returns a sanitized availability error when billing is disabled", async () => {
    const app = await registerRoutes({ stripe: null });
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: { plan: "specialist" },
      url: "/api/billing/checkout-sessions",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      code: "BILLING_UNAVAILABLE",
      message: "A cobrança está temporariamente indisponível.",
    });
  });

  it("does not expose provider errors returned by portal creation", async () => {
    const stripe = createStripe();
    stripe.createPortal.mockRejectedValue(new Error("secret provider detail"));
    const app = await registerRoutes({ stripe: stripe.service });
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      url: "/api/billing/portal-sessions",
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("secret provider detail");
  });

  it("rejects Stripe webhooks without a signature", async () => {
    const stripe = createStripe();
    const app = await registerRoutes({ stripe: stripe.service });
    const response = await app.inject({
      method: "POST",
      payload: { id: "event-1" },
      url: "/api/billing/webhooks/stripe",
    });

    expect(response.statusCode).toBe(400);
    expect(stripe.constructEvent).not.toHaveBeenCalled();
  });
});
