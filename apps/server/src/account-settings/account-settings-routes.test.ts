import Fastify from "fastify";
import { APIError } from "better-auth/api";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createAccountSettingsRoutes } from "./account-settings-routes.ts";

const queries = vi.hoisted(() => ({
  createAccountExport: vi.fn(),
  getAccountProfile: vi.fn(),
  getStudyPreference: vi.fn(),
  listSafeSessions: vi.fn(),
  revokeOtherOwnedSessions: vi.fn(),
  revokeOwnedSession: vi.fn(),
  updateStudyPreference: vi.fn(),
}));

vi.mock("./account-settings-queries.ts", () => queries);

const apps: ReturnType<typeof Fastify>[] = [];
const session = {
  session: { id: "session-1" },
  user: { email: "ana@example.com", id: "user-1", name: "Ana" },
};
const database = {} as Database;

const register = async (sessionValue: typeof session | null = session) => {
  const deleteUser = vi.fn().mockResolvedValue(undefined);
  const rollbackAccountDeletion = vi.fn();
  const auth = {
    api: {
      deleteUser,
      getSession: vi.fn().mockResolvedValue(sessionValue),
    },
  } as unknown as Auth;
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createAccountSettingsRoutes({
      auth,
      database,
      googleEnabled: true,
      rollbackAccountDeletion,
      websiteUrl: "http://localhost:3000",
    }),
  );
  return { app, deleteUser, rollbackAccountDeletion };
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("account settings routes", () => {
  it("requires authentication before returning account data", async () => {
    const { app } = await register(null);
    const response = await app.inject({ method: "GET", url: "/api/account-settings/profile" });
    expect(response.statusCode).toBe(401);
    expect(queries.getAccountProfile).not.toHaveBeenCalled();
  });

  it("validates retention before persisting it for the authenticated user", async () => {
    const { app } = await register();
    const invalid = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "PUT",
      payload: { desiredRetention: 99 },
      url: "/api/account-settings/study",
    });
    expect(invalid.statusCode).toBe(400);
    expect(queries.updateStudyPreference).not.toHaveBeenCalled();

    queries.updateStudyPreference.mockResolvedValue({ desiredRetention: 92, isDefault: false });
    const valid = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "PUT",
      payload: { desiredRetention: 92 },
      url: "/api/account-settings/study",
    });
    expect(valid.statusCode).toBe(200);
    expect(queries.updateStudyPreference).toHaveBeenCalledWith(database, "user-1", 92);
  });

  it("queues an emailed copy without exposing export files or download routes", async () => {
    queries.createAccountExport.mockResolvedValue("export-1");
    const { app } = await register();
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: { categories: ["account", "projects"] },
      url: "/api/account-exports",
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ success: true });
    expect(queries.createAccountExport).toHaveBeenCalledWith(database, "user-1", [
      "account",
      "projects",
    ]);
    expect((await app.inject({ method: "GET", url: "/api/account-exports" })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: "/api/account-exports/export-1/download" }))
        .statusCode,
    ).toBe(404);
  });

  it("does not invoke account deletion unless the repeated email matches", async () => {
    const { app, deleteUser } = await register();
    const mismatch = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "DELETE",
      payload: { confirmationEmail: "outra@example.com", password: "secret" },
      url: "/api/account",
    });
    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json()).toMatchObject({ code: "ACCOUNT_CONFIRMATION_MISMATCH" });
    expect(deleteUser).not.toHaveBeenCalled();

    const accepted = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "DELETE",
      payload: { confirmationEmail: "ANA@example.com", password: "secret" },
      url: "/api/account",
    });
    expect(accepted.statusCode).toBe(200);
    expect(deleteUser).toHaveBeenCalledOnce();
    expect(deleteUser.mock.calls[0]?.[0]).toMatchObject({ body: { password: "secret" } });
  });

  it("discards staged object cleanup when account deletion is rejected", async () => {
    const { app, deleteUser, rollbackAccountDeletion } = await register();
    deleteUser.mockRejectedValueOnce(
      new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD", message: "Invalid password" }),
    );

    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "DELETE",
      payload: { confirmationEmail: "ana@example.com", password: "wrong" },
      url: "/api/account",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "ACCOUNT_REAUTHENTICATION_FAILED" });
    expect(rollbackAccountDeletion).toHaveBeenCalledWith("user-1");
  });

  it("does not misreport an internal deletion failure as invalid credentials", async () => {
    const { app, deleteUser, rollbackAccountDeletion } = await register();
    deleteUser.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "DELETE",
      payload: { confirmationEmail: "ana@example.com", password: "secret" },
      url: "/api/account",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ code: "ACCOUNT_DELETION_FAILED" });
    expect(rollbackAccountDeletion).toHaveBeenCalledWith("user-1");
  });

  it("uses a dedicated rate limit for session revocation", async () => {
    queries.revokeOwnedSession.mockResolvedValue(true);
    queries.createAccountExport.mockResolvedValue("export-1");
    const { app } = await register();
    const headers = { origin: "http://localhost:3000" };

    for (let index = 0; index < 20; index += 1) {
      const response = await app.inject({
        headers,
        method: "DELETE",
        url: `/api/account-settings/sessions/session-${index + 2}`,
      });
      expect(response.statusCode).toBe(200);
    }

    const limited = await app.inject({
      headers,
      method: "DELETE",
      url: "/api/account-settings/sessions/session-22",
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ code: "SESSION_REVOCATION_RATE_LIMITED" });

    const exportResponse = await app.inject({
      headers,
      method: "POST",
      payload: { categories: ["account"] },
      url: "/api/account-exports",
    });
    expect(exportResponse.statusCode).toBe(202);
  });
});
