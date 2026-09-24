import { describe, expect, it } from "vitest";

import { ApiError, getApiErrorMessage } from "./api-client.ts";

describe("API error messages", () => {
  it("uses a mapped public message for known error codes", () => {
    const error = new ApiError(404, "NOT_FOUND");

    expect(getApiErrorMessage(error, "Fallback", { NOT_FOUND: "Não encontrado." })).toBe(
      "Não encontrado.",
    );
  });

  it("uses the fallback for unknown and non-API errors", () => {
    expect(getApiErrorMessage(new ApiError(500, "UNKNOWN"), "Fallback")).toBe("Fallback");
    expect(getApiErrorMessage(new Error("private"), "Fallback")).toBe("Fallback");
  });
});
