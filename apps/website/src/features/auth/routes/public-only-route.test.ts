import { describe, expect, it } from "vitest";

import { resolvePublicOnlyRoute } from "./public-only-route.tsx";

describe("public-only route session resolution", () => {
  it("blocks the public form only while the initial session is unresolved", () => {
    const initial = resolvePublicOnlyRoute({ data: null, error: null, isPending: true }, false);
    expect(initial).toEqual({ resolved: false, view: "loading" });

    const anonymous = resolvePublicOnlyRoute(
      { data: null, error: null, isPending: false },
      initial.resolved,
    );
    expect(anonymous).toEqual({ resolved: true, view: "public" });
  });

  it("keeps the public form mounted during a background refetch", () => {
    expect(resolvePublicOnlyRoute({ data: null, error: null, isPending: true }, true)).toEqual({
      resolved: true,
      view: "public",
    });
  });

  it("keeps the public form mounted if a background revalidation fails", () => {
    expect(
      resolvePublicOnlyRoute({ data: null, error: new Error("offline"), isPending: false }, true),
    ).toEqual({ resolved: true, view: "public" });
  });

  it("redirects when revalidation finds an authenticated session", () => {
    expect(
      resolvePublicOnlyRoute(
        { data: { user: { id: "user-1" } }, error: null, isPending: false },
        true,
      ),
    ).toEqual({ resolved: true, view: "authenticated" });
  });
});
