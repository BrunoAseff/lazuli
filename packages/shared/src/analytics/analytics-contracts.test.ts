import { describe, expect, it } from "vitest";

import { analyticsEventSchemas } from "./analytics-contracts.ts";

describe("analytics event schemas", () => {
  it("accepts only the allowlisted product properties", () => {
    expect(
      analyticsEventSchemas.ai_generation_completed.parse({
        kind: "flashcard",
        quantity: 4,
        scope: "selection",
      }),
    ).toEqual({ kind: "flashcard", quantity: 4, scope: "selection" });

    expect(() =>
      analyticsEventSchemas.ai_generation_completed.parse({
        documentTitle: "Segredo",
        kind: "flashcard",
        quantity: 4,
        scope: "selection",
      }),
    ).toThrow();
  });

  it("rejects unbounded error values and invalid counts", () => {
    expect(
      analyticsEventSchemas.document_import_failed.safeParse({
        errorCode: "raw provider message",
        format: "pdf",
      }).success,
    ).toBe(false);
    expect(
      analyticsEventSchemas.practice_started.safeParse({ kind: "quiz", itemCount: 0 }).success,
    ).toBe(false);
  });
});
