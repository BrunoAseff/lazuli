import { expect, it } from "vitest";
import { resolveActiveResult } from "./search-selection.ts";

it("keeps a listed choice and falls back to the first result otherwise", () => {
  expect(resolveActiveResult(["document:a", "flashcard:b"], "flashcard:b")).toBe("flashcard:b");
  // Navigation chosen before typing is no longer on screen once results replace it.
  expect(resolveActiveResult(["document:a", "flashcard:b"], "nav:/dashboard")).toBe("document:a");
  expect(resolveActiveResult(["document:a"], "")).toBe("document:a");
  expect(resolveActiveResult([], "document:a")).toBe("");
});
