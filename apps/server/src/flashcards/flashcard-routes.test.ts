import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { createFlashcardRoutes } from "./flashcard-routes.ts";

const queries = vi.hoisted(() => ({
  batchFlashcards: vi.fn(),
  createFlashcard: vi.fn(),
  deleteFlashcard: vi.fn(),
  getFlashcard: vi.fn(),
  importFlashcards: vi.fn(),
  listFlashcards: vi.fn(),
  updateFlashcard: vi.fn(),
}));
vi.mock("./flashcard-queries.ts", () => queries);

const collectionId = "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62";
const cardId = "8a9c628c-b222-42d9-a507-d8528f5015c0";
const apps: ReturnType<typeof Fastify>[] = [];
const database = {} as Database;
const storage = {} as ObjectStorage;
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
    createFlashcardRoutes({ auth, database, storage, websiteUrl: "http://localhost:3000" }),
  );
  return app;
};
const content = (text: string) => [
  {
    id: crypto.randomUUID(),
    type: "paragraph",
    content: [{ type: "text", text, styles: {} }],
  },
];
const card = {
  id: cardId,
  collectionId,
  question: content("Pergunta"),
  answer: content("Resposta"),
  questionText: "Pergunta",
  answerText: "Resposta",
  questionHasImage: false,
  answerHasImage: false,
  contentSchemaVersion: 1,
  dueAt: new Date("2026-08-23T12:00:00.000Z"),
  lastReviewedAt: null,
  archivedAt: null,
  createdAt: new Date("2026-08-23T12:00:00.000Z"),
  updatedAt: new Date("2026-08-23T12:00:00.000Z"),
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("flashcard routes", () => {
  it("requires authentication for the card list", async () => {
    const app = await register(createAuth(null));
    const response = await app.inject({
      method: "GET",
      url: `/api/flashcard-collections/${collectionId}/cards`,
    });
    expect(response.statusCode).toBe(401);
    expect(queries.listFlashcards).not.toHaveBeenCalled();
  });

  it("rejects empty rich content before reaching the query", async () => {
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: {
        id: cardId,
        question: [{ id: "empty", type: "paragraph", content: [] }],
        answer: content("Resposta"),
      },
      url: `/api/flashcard-collections/${collectionId}/cards`,
    });
    expect(response.statusCode).toBe(400);
    expect(queries.createFlashcard).not.toHaveBeenCalled();
  });

  it("returns an idempotently created card with serialized dates", async () => {
    queries.createFlashcard.mockResolvedValue({ kind: "ok", card, created: false });
    const app = await register();
    const question = content("Pergunta");
    const answer = content("Resposta");
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: { id: cardId, question, answer },
      url: `/api/flashcard-collections/${collectionId}/cards`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().dueAt).toBe("2026-08-23T12:00:00.000Z");
    expect(queries.createFlashcard).toHaveBeenCalledWith(database, "user-1", collectionId, {
      id: cardId,
      question,
      answer,
    });
  });

  it("does not reveal an unowned card during deletion", async () => {
    queries.deleteFlashcard.mockResolvedValue(false);
    const app = await register();
    const response = await app.inject({
      method: "DELETE",
      headers: { origin: "http://localhost:3000" },
      url: `/api/flashcard-collections/${collectionId}/cards/${cardId}`,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "FLASHCARD_NOT_FOUND" });
  });

  it("imports a validated flashcard batch atomically", async () => {
    queries.importFlashcards.mockResolvedValue({ kind: "ok", imported: 2 });
    const app = await register();
    const cards = [
      { id: crypto.randomUUID(), question: "Pergunta 1", answer: "Resposta 1" },
      { id: crypto.randomUUID(), question: "Pergunta 2", answer: "Resposta 2" },
    ];
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: { cards },
      url: `/api/flashcard-collections/${collectionId}/cards/import`,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ imported: 2 });
    expect(queries.importFlashcards).toHaveBeenCalledWith(database, "user-1", collectionId, {
      cards,
    });
  });
});
