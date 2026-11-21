import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createDashboardRoutes } from "./dashboard-routes.ts";

const queries = vi.hoisted(() => ({
  dismissDashboardOnboarding: vi.fn(),
  getDashboard: vi.fn(),
}));

vi.mock("./dashboard-queries.ts", () => queries);

const apps: ReturnType<typeof Fastify>[] = [];
const database = {} as Database;
const session = {
  session: { id: "session-1" },
  user: { email: "ana@example.com", id: "user-1", name: "Ana" },
};
const auth = (value: typeof session | null) =>
  ({ api: { getSession: vi.fn().mockResolvedValue(value) } }) as unknown as Auth;

const dashboardPayload = {
  reviewQueue: {
    totalDueReviews: 0,
    totalNewCards: 0,
    nextReviewAt: null,
    availableCollectionCount: 0,
    hiddenCollectionCount: 0,
    collections: [],
  },
  onboarding: {
    visible: false,
    steps: [
      { id: "create-document", completed: true, href: "/documents" },
      { id: "generate-material", completed: true, href: "/documents" },
      { id: "set-goal", completed: true, href: "/stone?meta=editar" },
      { id: "practice-example", completed: true, href: "/flashcards" },
    ],
  },
  recentDocuments: [],
  quizContinuations: [],
};

const register = async (sessionValue: typeof session | null = session) => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createDashboardRoutes({
      auth: auth(sessionValue),
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

describe("dashboard routes", () => {
  it("requires authentication before loading the summary", async () => {
    const app = await register(null);
    const response = await app.inject({ method: "GET", url: "/api/dashboard" });
    expect(response.statusCode).toBe(401);
    expect(queries.getDashboard).not.toHaveBeenCalled();
  });

  it("loads the summary for the signed-in account", async () => {
    queries.getDashboard.mockResolvedValue(dashboardPayload);
    const app = await register();

    const response = await app.inject({ method: "GET", url: "/api/dashboard" });

    expect(response.statusCode).toBe(200);
    expect(queries.getDashboard).toHaveBeenCalledWith(database, "user-1");
  });

  it("rejects cross-origin and invalid dismissal mutations", async () => {
    const app = await register();
    const crossOrigin = await app.inject({
      headers: { origin: "https://evil.example" },
      method: "PATCH",
      payload: { dismissed: true },
      url: "/api/dashboard/onboarding",
    });
    expect(crossOrigin.statusCode).toBe(403);

    const invalid = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "PATCH",
      payload: { dismissed: false },
      url: "/api/dashboard/onboarding",
    });
    expect(invalid.statusCode).toBe(400);
    expect(queries.dismissDashboardOnboarding).not.toHaveBeenCalled();
  });

  it("dismisses onboarding only for the authenticated account", async () => {
    queries.dismissDashboardOnboarding.mockResolvedValue({
      dismissedAt: new Date("2026-10-21T12:00:00.000Z"),
    });
    const app = await register();
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "PATCH",
      payload: { dismissed: true },
      url: "/api/dashboard/onboarding",
    });
    expect(response.statusCode).toBe(200);
    expect(queries.dismissDashboardOnboarding).toHaveBeenCalledWith(database, "user-1");
  });
});
