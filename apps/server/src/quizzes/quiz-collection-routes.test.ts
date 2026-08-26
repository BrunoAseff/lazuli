import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createQuizCollectionRoutes } from "./quiz-collection-routes.ts";

const queries = vi.hoisted(() => ({
  createQuizCollection: vi.fn(),
  deleteQuizCollection: vi.fn(),
  getQuizCollection: vi.fn(),
  listQuizCollections: vi.fn(),
  updateQuizCollection: vi.fn(),
}));
vi.mock("./quiz-collection-queries.ts", () => queries);

const apps: ReturnType<typeof Fastify>[] = [];
const database = {} as Database;
const session = {
  session: { id: "session-1" },
  user: { id: "user-1", email: "ana@example.com", name: "Ana" },
};
const createAuth = (value: typeof session | null) =>
  ({ api: { getSession: vi.fn().mockResolvedValue(value) } }) as unknown as Auth;
const register = async (auth = createAuth(session)) => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createQuizCollectionRoutes({ auth, database, websiteUrl: "http://localhost:3000" }),
  );
  return app;
};
const collection = {
  id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
  title: "História",
  project: null,
  archivedAt: null,
  totalQuestions: 0,
  totalAttempts: 0,
  attemptsLastSevenDays: 0,
  lastScore: null,
  bestScoreRate: null,
  lastAttemptAt: null,
  createdAt: new Date("2026-08-25T12:00:00.000Z"),
  updatedAt: new Date("2026-08-25T12:00:00.000Z"),
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("quiz collection routes", () => {
  it("requires authentication for the collection list", async () => {
    const app = await register(createAuth(null));
    const response = await app.inject({ method: "GET", url: "/api/quiz-collections" });

    expect(response.statusCode).toBe(401);
    expect(queries.listQuizCollections).not.toHaveBeenCalled();
  });

  it("passes normalized filters and serializes quiz metrics", async () => {
    queries.listQuizCollections.mockResolvedValue({
      items: [collection],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    const app = await register();
    const response = await app.inject({
      method: "GET",
      url: "/api/quiz-collections?project=none&status=archived&query=história",
    });

    expect(response.statusCode).toBe(200);
    expect(queries.listQuizCollections).toHaveBeenCalledWith(database, "user-1", {
      page: 1,
      pageSize: 12,
      project: "none",
      query: "história",
      status: "archived",
    });
    expect(response.json().items[0].createdAt).toBe("2026-08-25T12:00:00.000Z");
  });

  it("rejects mutations from another origin", async () => {
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "https://example.com" },
      payload: { id: collection.id, title: collection.title, projectId: null },
      url: "/api/quiz-collections",
    });

    expect(response.statusCode).toBe(403);
    expect(queries.createQuizCollection).not.toHaveBeenCalled();
  });

  it("returns an idempotently created collection without leaking internal state", async () => {
    queries.createQuizCollection.mockResolvedValue({ kind: "ok", created: false, collection });
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: { id: collection.id, title: collection.title, projectId: null },
      url: "/api/quiz-collections",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: collection.id, title: collection.title });
  });

  it("uses the same not-found response for an unowned collection", async () => {
    queries.updateQuizCollection.mockResolvedValue({ kind: "not-found" });
    const app = await register();
    const response = await app.inject({
      method: "PATCH",
      headers: { origin: "http://localhost:3000" },
      payload: { title: "Nova" },
      url: `/api/quiz-collections/${collection.id}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "COLLECTION_NOT_FOUND" });
  });
});
