import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsService } from "../analytics/analytics-service.ts";
import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { createQuizRoutes } from "./quiz-routes.ts";

const attemptQueries = vi.hoisted(() => ({
  abandonQuizAttempt: vi.fn(),
  answerQuizAttemptItem: vi.fn(),
  completeQuizAttempt: vi.fn(),
  createQuizAttempt: vi.fn(),
  getQuizAttempt: vi.fn(),
  getQuizAttemptAvailability: vi.fn(),
}));
const questionQueries = vi.hoisted(() => ({
  createQuizQuestion: vi.fn(),
  deleteQuizQuestion: vi.fn(),
  getQuizQuestion: vi.fn(),
  listQuizQuestions: vi.fn(),
  updateQuizQuestion: vi.fn(),
}));
vi.mock("./quiz-attempt-queries.ts", () => attemptQueries);
vi.mock("./quiz-question-queries.ts", () => questionQueries);

const attemptId = "8a9c628c-b222-42d9-a507-d8528f5015c0";
const apps: ReturnType<typeof Fastify>[] = [];
const analytics = { capture: vi.fn() } as unknown as AnalyticsService;
const auth = {
  api: {
    getSession: vi.fn().mockResolvedValue({
      session: { id: "session-1" },
      user: { id: "user-1", email: "ana@example.com", name: "Ana" },
    }),
  },
} as unknown as Auth;
const completedAttempt = {
  id: attemptId,
  status: "completed",
  totalQuestions: 3,
};

const register = async () => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createQuizRoutes({
      analytics,
      auth,
      database: {} as Database,
      enforceCommercialLimits: false,
      storage: {} as ObjectStorage,
      websiteUrl: "http://localhost:3000",
    }),
  );
  return app;
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("quiz analytics", () => {
  it("does not recapture an already completed attempt", async () => {
    attemptQueries.completeQuizAttempt.mockResolvedValue({
      kind: "ok",
      completed: false,
      attempt: completedAttempt,
    });
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      url: `/api/quiz-attempts/${attemptId}/complete`,
    });
    expect(response.statusCode).toBe(200);
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it("captures the transition that completes an attempt", async () => {
    attemptQueries.completeQuizAttempt.mockResolvedValue({
      kind: "ok",
      completed: true,
      attempt: completedAttempt,
    });
    const app = await register();
    const response = await app.inject({
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      url: `/api/quiz-attempts/${attemptId}/complete`,
    });
    expect(response.statusCode).toBe(200);
    expect(analytics.capture).toHaveBeenCalledWith("user-1", "practice_completed", {
      itemCount: 3,
      kind: "quiz",
    });
  });
});
