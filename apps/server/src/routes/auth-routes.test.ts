import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerEnv } from "../config.ts";
import { createAuthRoutes } from "./auth-routes.ts";

const env = {
  BETTER_AUTH_URL: "http://localhost:3001",
} as ServerEnv;

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("authRoutes", () => {
  it("forwards the request and every session cookie returned by Better Auth", async () => {
    const handler = vi.fn(async (request: Request) => {
      expect(request.url).toBe("http://localhost:3001/api/auth/sign-in/email");
      expect(request.method).toBe("POST");
      await expect(request.json()).resolves.toEqual({ email: "aluna@example.com" });

      const headers = new Headers({ "content-type": "application/json" });
      headers.append("set-cookie", "session=abc; HttpOnly; Path=/");
      headers.append("set-cookie", "state=xyz; HttpOnly; Path=/");
      return new Response(JSON.stringify({ ok: true }), { headers, status: 200 });
    });
    const app = Fastify();
    apps.push(app);
    await app.register(createAuthRoutes({ handler }, env));

    const response = await app.inject({
      method: "POST",
      payload: { email: "aluna@example.com" },
      url: "/api/auth/sign-in/email",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(response.headers["set-cookie"]).toEqual([
      "session=abc; HttpOnly; Path=/",
      "state=xyz; HttpOnly; Path=/",
    ]);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("returns a safe error when the authentication handler fails", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);
    await app.register(
      createAuthRoutes(
        {
          handler: async () => {
            throw new Error("database unavailable");
          },
        },
        env,
      ),
    );

    const response = await app.inject({ method: "GET", url: "/api/auth/get-session" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: "AUTH_FAILURE",
      message: "Não foi possível concluir a autenticação.",
    });
    expect(response.body).not.toContain("database unavailable");
  });
});
