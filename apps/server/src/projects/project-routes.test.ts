import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createProjectRoutes } from "./project-routes.ts";

const projectQueries = vi.hoisted(() => ({
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  getProject: vi.fn(),
  listProjectDocuments: vi.fn(),
  listProjects: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("./project-queries.ts", () => projectQueries);

const apps: ReturnType<typeof Fastify>[] = [];
const database = {} as Database;
const verifiedSession = {
  session: { id: "session-1" },
  user: { id: "user-1", email: "ana@example.com", name: "Ana" },
};

const createAuth = (session: typeof verifiedSession | null) =>
  ({ api: { getSession: vi.fn().mockResolvedValue(session) } }) as unknown as Auth;

const registerRoutes = async (auth: Auth) => {
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(createProjectRoutes({ auth, database, websiteUrl: "http://localhost:3000" }));
  return app;
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("project routes", () => {
  it("requires a session before listing projects", async () => {
    const app = await registerRoutes(createAuth(null));
    const response = await app.inject({ method: "GET", url: "/api/projects" });

    expect(response.statusCode).toBe(401);
    expect(projectQueries.listProjects).not.toHaveBeenCalled();
  });

  it("uses the session owner and returns serialized paginated projects", async () => {
    projectQueries.listProjects.mockResolvedValue({
      items: [
        {
          id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
          title: "Física",
          coverKey: "orbit",
          documentCount: 2,
          createdAt: new Date("2026-08-17T12:00:00.000Z"),
          updatedAt: new Date("2026-08-17T13:00:00.000Z"),
        },
      ],
      pagination: { page: 2, pageSize: 12, totalItems: 13, totalPages: 2 },
    });
    const app = await registerRoutes(createAuth(verifiedSession));
    const response = await app.inject({
      method: "GET",
      url: "/api/projects?page=2&query=fisica",
    });

    expect(response.statusCode).toBe(200);
    expect(projectQueries.listProjects).toHaveBeenCalledWith(database, "user-1", {
      page: 2,
      pageSize: 12,
      query: "fisica",
    });
    expect(response.json().items[0].updatedAt).toBe("2026-08-17T13:00:00.000Z");
  });

  it("rejects a mutation from an untrusted origin before touching data", async () => {
    const app = await registerRoutes(createAuth(verifiedSession));
    const response = await app.inject({
      method: "POST",
      headers: { origin: "https://example.com" },
      payload: {
        id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
        title: "Física",
        coverKey: "orbit",
      },
      url: "/api/projects",
    });

    expect(response.statusCode).toBe(403);
    expect(projectQueries.createProject).not.toHaveBeenCalled();
  });

  it("does not distinguish an absent project from one outside the session scope", async () => {
    projectQueries.getProject.mockResolvedValue(null);
    const app = await registerRoutes(createAuth(verifiedSession));
    const response = await app.inject({
      method: "GET",
      url: "/api/projects/2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "PROJECT_NOT_FOUND" });
    expect(projectQueries.getProject).toHaveBeenCalledWith(
      database,
      "user-1",
      "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
    );
  });

  it("delegates atomic project deletion to the query layer", async () => {
    projectQueries.deleteProject.mockResolvedValue(true);
    const app = await registerRoutes(createAuth(verifiedSession));
    const response = await app.inject({
      method: "DELETE",
      headers: { origin: "http://localhost:3000" },
      url: "/api/projects/2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
    });

    expect(response.statusCode).toBe(204);
    expect(projectQueries.deleteProject).toHaveBeenCalledWith(
      database,
      "user-1",
      "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
    );
  });
});
