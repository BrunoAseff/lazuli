import { describe, expect, it } from "vitest";

import { calculateFlashcardProgress } from "./flashcard-metrics.ts";

describe("calculateFlashcardProgress", () => {
  it("returns zero for an empty collection", () => {
    expect(calculateFlashcardProgress(0, 0)).toBe(0);
  });

  it("rounds the studied share to the nearest percentage", () => {
    expect(calculateFlashcardProgress(2, 3)).toBe(67);
  });
});
