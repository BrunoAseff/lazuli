import { describe, expect, it } from "vitest";

import { buildSearchParams, mergeSearchParams } from "./search-params.ts";

describe("search params", () => {
  it("omits empty values when building params", () => {
    expect(
      buildSearchParams({ page: 2, project: undefined, query: "memory", status: null }).toString(),
    ).toBe("page=2&query=memory");
  });

  it("merges changes, removes defaults, and resets pagination", () => {
    const current = new URLSearchParams("page=4&sort=created&status=archived");
    const next = mergeSearchParams(
      current,
      { query: "memory", sort: "updated", status: "active" },
      { defaults: { sort: "updated", status: "active" } },
    );

    expect(next.toString()).toBe("query=memory");
  });

  it("keeps pagination when requested", () => {
    const next = mergeSearchParams(
      new URLSearchParams("page=3"),
      { query: "memory" },
      {
        resetPage: false,
      },
    );

    expect(next.toString()).toBe("page=3&query=memory");
  });
});
