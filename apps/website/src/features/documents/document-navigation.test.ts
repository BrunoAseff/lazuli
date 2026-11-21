import { describe, expect, it } from "vitest";

import { safeReturnTo } from "./document-navigation.ts";

describe("safeReturnTo", () => {
  it("keeps paths inside the app", () => {
    expect(safeReturnTo("/flashcards/1?card=2")).toBe("/flashcards/1?card=2");
  });

  it("refuses anything the browser would read as another site", () => {
    for (const value of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "evil"])
      expect(safeReturnTo(value)).toBeNull();
  });
});
