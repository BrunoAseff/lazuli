import { describe, expect, it } from "vitest";

import { isValidAccountName, normalizeAccountName } from "./account-name.ts";

describe("account name", () => {
  it("normalizes whitespace before storing a name", () => {
    expect(normalizeAccountName("  Ana   Maria\nSilva  ")).toBe("Ana Maria Silva");
  });

  it("enforces the same length limits used by the registration form", () => {
    expect(isValidAccountName("A")).toBe(false);
    expect(isValidAccountName("Ana Silva")).toBe(true);
    expect(isValidAccountName("A".repeat(81))).toBe(false);
  });
});
