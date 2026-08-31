import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createFlashcardPracticeRoutes } from "./flashcard-practice-routes.ts";

const queries = vi.hoisted(() => ({
  abandonPracticeSession: vi.fn(),
  createPracticeSession: vi.fn(),
  getPracticeAvailability: vi.fn(),
  getPracticeSession: vi.fn(),
  submitPracticeReview: vi.fn(),
}));
vi.mock("./flashcard-practice-queries.ts", () => queries);

const collectionId = "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62";
const sessionId = "8a9c628c-b222-42d9-a507-d8528f5015c0";
const reviewId = "51e19888-da91-4723-a170-23315343290a";
const apps: ReturnType<typeof Fastify>[] = [];
const database = {} as Database;
const authSession = {
  session: { id: "session-1" },
  user: { id: "user-1", email: "ana@example.com", name: "Ana" },
};
const createAuth = (value: typeof authSession | null) =>
  ({ api: { getSession: vi.fn().mockResolvedValue(value) } }) as unknown as Auth;
const register = async (auth = createAuth(authSession)) => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createFlashcardPracticeRoutes({ auth, database, websiteUrl: "http://localhost:3000" }),
  );
  return app;
};
const completedSession = {
  id: sessionId,
  collectionId,
  collectionTitle: "Anatomia",
  status: "completed" as const,
  totalCards: 1,
  reviewedCards: 1,
  startedAt: new Date("2026-08-23T12:00:00.000Z"),
  lastActivityAt: new Date("2026-08-23T12:01:00.000Z"),
  finishedAt: new Date("2026-08-23T12:01:00.000Z"),
  currentItem: null,
  reviewedMaterials: [],
  ratings: { again: 0, hard: 0, good: 1, easy: 0 },
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("flashcard practice routes", () => {
  it("does not expose sessions without authentication", async () => {
    const app = await register(createAuth(null));
    const response = await app.inject({
      method: "GET",
      url: `/api/flashcard-practice-sessions/${sessionId}`,
    });
    expect(response.statusCode).toBe(401);
    expect(queries.getPracticeSession).not.toHaveBeenCalled();
  });

  it("rejects calculated fields supplied by the client", async () => {
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: {
        id: reviewId,
        itemId: "7412788b-ef4b-4bbd-8cab-493d32738867",
        rating: "good",
        dueAt: "2099-01-01T00:00:00.000Z",
      },
      url: `/api/flashcard-practice-sessions/${sessionId}/reviews`,
    });
    expect(response.statusCode).toBe(400);
    expect(queries.submitPracticeReview).not.toHaveBeenCalled();
  });

  it("serializes an idempotent review response", async () => {
    queries.submitPracticeReview.mockResolvedValue({ kind: "ok", session: completedSession });
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      payload: {
        id: reviewId,
        itemId: "7412788b-ef4b-4bbd-8cab-493d32738867",
        rating: "good",
      },
      url: `/api/flashcard-practice-sessions/${sessionId}/reviews`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: sessionId, status: "completed" });
    expect(response.json().finishedAt).toBe("2026-08-23T12:01:00.000Z");
  });
});
