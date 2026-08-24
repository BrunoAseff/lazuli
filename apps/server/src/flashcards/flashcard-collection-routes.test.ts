import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createFlashcardCollectionRoutes } from "./flashcard-collection-routes.ts";

const queries = vi.hoisted(() => ({
  createFlashcardCollection: vi.fn(),
  deleteFlashcardCollection: vi.fn(),
  getFlashcardCollection: vi.fn(),
  listFlashcardCollections: vi.fn(),
  updateFlashcardCollection: vi.fn(),
}));
vi.mock("./flashcard-collection-queries.ts", () => queries);

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
    createFlashcardCollectionRoutes({
      auth,
      database,
      websiteUrl: "http://localhost:3000",
    }),
  );
  return app;
};
const collection = {
  id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
  title: "Anatomia",
  project: null,
  archivedAt: null,
  totalCards: 0,
  studiedCards: 0,
  dueCards: 0,
  nextPracticeAt: null,
  reviewsLastSevenDays: 0,
  lastReviewedAt: null,
  createdAt: new Date("2026-08-20T12:00:00.000Z"),
  updatedAt: new Date("2026-08-20T12:00:00.000Z"),
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("flashcard collection routes", () => {
  it("requires authentication for the collection list", async () => {
    const app = await register(createAuth(null));
    const response = await app.inject({ method: "GET", url: "/api/flashcard-collections" });

    expect(response.statusCode).toBe(401);
    expect(queries.listFlashcardCollections).not.toHaveBeenCalled();
  });

  it("passes normalized filters and serializes metrics", async () => {
    queries.listFlashcardCollections.mockResolvedValue({
      items: [collection],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    const app = await register();
    const response = await app.inject({
      method: "GET",
      url: "/api/flashcard-collections?project=none&status=archived&query=anato",
    });

    expect(response.statusCode).toBe(200);
    expect(queries.listFlashcardCollections).toHaveBeenCalledWith(database, "user-1", {
      page: 1,
      pageSize: 12,
      project: "none",
      query: "anato",
      status: "archived",
    });
    expect(response.json().items[0].createdAt).toBe("2026-08-20T12:00:00.000Z");
  });

  it("returns an owned collection detail without exposing content", async () => {
    queries.getFlashcardCollection.mockResolvedValue(collection);
    const app = await register();
    const response = await app.inject({
      method: "GET",
      url: `/api/flashcard-collections/${collection.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(queries.getFlashcardCollection).toHaveBeenCalledWith(database, "user-1", collection.id);
    expect(response.json()).toMatchObject({ id: collection.id, title: "Anatomia" });
  });

  it("rejects collection mutations from another origin", async () => {
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "https://example.com" },
      payload: { id: collection.id, title: collection.title, projectId: null },
      url: "/api/flashcard-collections",
    });

    expect(response.statusCode).toBe(403);
    expect(queries.createFlashcardCollection).not.toHaveBeenCalled();
  });

  it("returns the existing collection for an idempotent creation", async () => {
    queries.createFlashcardCollection.mockResolvedValue({
      kind: "ok",
      created: false,
      collection,
    });
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: { id: collection.id, title: collection.title, projectId: null },
      url: "/api/flashcard-collections",
    });

    expect(response.statusCode).toBe(200);
    expect(queries.createFlashcardCollection).toHaveBeenCalledWith(database, "user-1", {
      id: collection.id,
      title: collection.title,
      projectId: null,
    });
  });

  it("does not expose whether a collection belongs to another account", async () => {
    queries.updateFlashcardCollection.mockResolvedValue({ kind: "not-found" });
    const app = await register();
    const response = await app.inject({
      method: "PATCH",
      headers: { origin: "http://localhost:3000" },
      payload: { title: "Nova" },
      url: `/api/flashcard-collections/${collection.id}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "COLLECTION_NOT_FOUND" });
  });

  it("returns not found when deletion does not match the session owner", async () => {
    queries.deleteFlashcardCollection.mockResolvedValue(false);
    const app = await register();
    const response = await app.inject({
      method: "DELETE",
      headers: { origin: "http://localhost:3000" },
      url: `/api/flashcard-collections/${collection.id}`,
    });

    expect(response.statusCode).toBe(404);
    expect(queries.deleteFlashcardCollection).toHaveBeenCalledWith(
      database,
      "user-1",
      collection.id,
    );
  });
});
