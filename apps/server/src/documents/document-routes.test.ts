import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createDocumentRoutes } from "./document-routes.ts";

const documentQueries = vi.hoisted(() => ({
  createProjectItem: vi.fn(),
  deleteProjectItem: vi.fn(),
  getDocument: vi.fn(),
  listProjectTree: vi.fn(),
  saveDocumentContent: vi.fn(),
  updateProjectItem: vi.fn(),
}));

vi.mock("./document-queries.ts", () => documentQueries);

const apps: ReturnType<typeof Fastify>[] = [];
const analyticsCapture = vi.fn();
const database = {} as Database;
const auth = {
  api: {
    getSession: vi.fn().mockResolvedValue({
      session: { id: "session-1" },
      user: { email: "ana@example.com", id: "user-1", name: "Ana" },
    }),
  },
} as unknown as Auth;

const register = async () => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createDocumentRoutes({
      analytics: { capture: analyticsCapture, shutdown: vi.fn() },
      auth,
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

describe("document routes", () => {
  it("captures only a newly persisted manual document", async () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    documentQueries.createProjectItem.mockResolvedValue({
      kind: "created",
      item: {
        createdAt: now,
        id: "22222222-2222-4222-8222-222222222222",
        parentId: null,
        position: 0,
        projectId: "11111111-1111-4111-8111-111111111111",
        title: "Conteúdo privado",
        type: "document",
        updatedAt: now,
      },
    });
    const app = await register();

    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: {
        id: "22222222-2222-4222-8222-222222222222",
        parentId: null,
        title: "Conteúdo privado",
        type: "document",
      },
      url: "/api/projects/11111111-1111-4111-8111-111111111111/items",
    });

    expect(response.statusCode).toBe(201);
    expect(analyticsCapture).toHaveBeenCalledWith("user-1", "document_created", {
      source: "manual",
    });
    expect(JSON.stringify(analyticsCapture.mock.calls)).not.toContain("Conteúdo privado");
  });
});
