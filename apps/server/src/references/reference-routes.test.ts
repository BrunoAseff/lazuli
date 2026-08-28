import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createReferenceRoutes } from "./reference-routes.ts";

const queries = vi.hoisted(() => ({
  createReferences: vi.fn(),
  deleteReference: vi.fn(),
  listReferences: vi.fn(),
}));
vi.mock("./reference-queries.ts", () => queries);

const database = {} as Database;
const documentId = "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62";
const cardId = "8a9c628c-b222-42d9-a507-d8528f5015c0";
const apps: ReturnType<typeof Fastify>[] = [];
const session = {
  session: { id: "session-1" },
  user: { id: "user-1", email: "ana@example.com", name: "Ana" },
};
const auth = {
  api: { getSession: vi.fn().mockResolvedValue(session) },
} as unknown as Auth;
const register = async () => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createReferenceRoutes({ auth, database, websiteUrl: "http://localhost:3000" }),
  );
  return app;
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("reference routes", () => {
  it("rejects a mutation from an untrusted origin", async () => {
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "https://malicious.example" },
      payload: {
        source: { type: "document", documentId },
        targets: [{ type: "flashcard", id: cardId }],
      },
      url: "/api/references",
    });
    expect(response.statusCode).toBe(403);
    expect(queries.createReferences).not.toHaveBeenCalled();
  });

  it("returns an idempotent success when the reference already exists", async () => {
    queries.createReferences.mockResolvedValue({ kind: "ok", created: 0, items: [] });
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: {
        source: { type: "document", documentId },
        targets: [{ type: "flashcard", id: cardId }],
      },
      url: "/api/references",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ created: 0, items: [] });
  });

  it("does not accept an anchor that is absent from persisted content", async () => {
    queries.createReferences.mockResolvedValue({ kind: "anchor-not-found" });
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: {
        source: { type: "selection", documentId, anchorId: "missing-anchor" },
        targets: [{ type: "flashcard", id: cardId }],
      },
      url: "/api/references",
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "REFERENCE_ANCHOR_NOT_FOUND" });
  });
});
