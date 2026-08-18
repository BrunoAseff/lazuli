import { describe, expect, it } from "vitest";

import { escapeLikePattern } from "./project-queries.ts";

describe("project query helpers", () => {
  it("escapes SQL LIKE wildcards as literal search characters", () => {
    expect(escapeLikePattern("100%_\\notes")).toBe("100\\%\\_\\\\notes");
  });
});
