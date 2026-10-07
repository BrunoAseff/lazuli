import { describe, expect, it } from "vitest";

import { hasExceededCollectionClaimAttempts } from "./ai-collection-worker.ts";

describe("AI collection worker claim limit", () => {
  it("processes the third claim and exhausts only a later claim", () => {
    expect(hasExceededCollectionClaimAttempts(1)).toBe(false);
    expect(hasExceededCollectionClaimAttempts(2)).toBe(false);
    expect(hasExceededCollectionClaimAttempts(3)).toBe(false);
    expect(hasExceededCollectionClaimAttempts(4)).toBe(true);
  });
});
