import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { AiCreditService } from "./ai-credit-service.ts";
import { createAiCreditRoutes } from "./ai-credit-routes.ts";

const apps: ReturnType<typeof Fastify>[] = [];
const session = {
  session: { id: "session-1" },
  user: { email: "ana@example.com", id: "user-1", name: "Ana" },
};
const auth = {
  api: { getSession: vi.fn().mockResolvedValue(session) },
} as unknown as Auth;

const register = async (service: Pick<AiCreditService, "getBalance" | "listLedger">) => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(createAiCreditRoutes({ auth, service }));
  return app;
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("AI credit routes", () => {
  it("returns only the authenticated user's balance", async () => {
    const service = {
      getBalance: vi.fn().mockResolvedValue({ available: 270, reserved: 20 }),
      listLedger: vi.fn(),
    };
    const app = await register(service);
    const response = await app.inject({ method: "GET", url: "/api/ai/credits" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ available: 270, reserved: 20 });
    expect(service.getBalance).toHaveBeenCalledWith("user-1");
  });

  it("paginates only the authenticated user's ledger", async () => {
    const service = {
      getBalance: vi.fn(),
      listLedger: vi.fn().mockResolvedValue({
        items: [
          {
            amount: 300,
            createdAt: new Date("2026-09-29T12:00:00.000Z"),
            generationId: null,
            id: "entry-1",
            reason: "Teste orientado",
            type: "grant",
          },
        ],
        totalItems: 1,
      }),
    };
    const app = await register(service);
    const response = await app.inject({
      method: "GET",
      url: "/api/ai/credits/ledger?page=2&pageSize=10",
    });
    expect(response.statusCode).toBe(200);
    expect(service.listLedger).toHaveBeenCalledWith("user-1", { page: 2, pageSize: 10 });
    expect(response.json()).toMatchObject({
      items: [{ createdAt: "2026-09-29T12:00:00.000Z" }],
      page: 2,
      pageSize: 10,
      totalItems: 1,
    });
  });

  it("does not expose credit data without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);
    const service = { getBalance: vi.fn(), listLedger: vi.fn() };
    const app = await register(service);
    const response = await app.inject({ method: "GET", url: "/api/ai/credits" });
    expect(response.statusCode).toBe(401);
    expect(service.getBalance).not.toHaveBeenCalled();
  });
});
