import { describe, expect, it, vi } from "vitest";

import { finishSignOut, readPendingSignOut, startSignOut } from "./sign-out.ts";

describe("sign out", () => {
  it("persists the return path before replacing the authenticated document", () => {
    const replace = vi.fn();
    const storage = { setItem: vi.fn() };

    startSignOut({ returnTo: "/dashboard?tab=reviews", userId: "user-1" }, { replace, storage });

    expect(storage.setItem).toHaveBeenCalledWith(
      "lazuli-pending-sign-out",
      JSON.stringify({ returnTo: "/dashboard?tab=reviews", userId: "user-1" }),
    );
    expect(storage.setItem.mock.invocationCallOrder[0]).toBeLessThan(
      replace.mock.invocationCallOrder[0]!,
    );
    expect(replace).toHaveBeenCalledWith("/signing-out");
  });

  it("reads only valid internal return paths", () => {
    expect(
      readPendingSignOut({
        getItem: () => JSON.stringify({ returnTo: "/settings/security", userId: "user-1" }),
      }),
    ).toEqual({ returnTo: "/settings/security", userId: "user-1" });
    expect(
      readPendingSignOut({ getItem: () => JSON.stringify({ returnTo: "https://example.com" }) }),
    ).toBeNull();
    expect(
      readPendingSignOut({ getItem: () => JSON.stringify({ returnTo: "//example.com" }) }),
    ).toBeNull();
    expect(readPendingSignOut({ getItem: () => "not-json" })).toBeNull();
  });

  it("cleans local state only after the server revokes the session", async () => {
    const removeCompletedImportsState = vi.fn();
    const removeItem = vi.fn();
    const revokeSession = vi.fn(async () => ({ error: null }));

    const result = await finishSignOut(
      { returnTo: "/dashboard", userId: "user-1" },
      {
        removeCompletedImportsState,
        revokeSession,
        storage: { getItem: vi.fn(), removeItem },
      },
    );

    expect(result.error).toBeNull();
    expect(removeCompletedImportsState).toHaveBeenCalledWith("user-1");
    expect(removeItem).toHaveBeenCalledWith("lazuli-pending-sign-out");
    expect(revokeSession.mock.invocationCallOrder[0]).toBeLessThan(
      removeCompletedImportsState.mock.invocationCallOrder[0]!,
    );
  });

  it("preserves pending state when revocation fails", async () => {
    const error = new Error("offline");
    const removeCompletedImportsState = vi.fn();
    const removeItem = vi.fn();

    const result = await finishSignOut(
      { returnTo: "/dashboard", userId: "user-1" },
      {
        removeCompletedImportsState,
        revokeSession: vi.fn(async () => ({ error })),
        storage: { getItem: vi.fn(), removeItem },
      },
    );

    expect(result.error).toBe(error);
    expect(removeCompletedImportsState).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
