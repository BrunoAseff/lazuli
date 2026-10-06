import { describe, expect, it } from "vitest";

import { isMissingBucketError } from "./object-storage.ts";

describe("isMissingBucketError", () => {
  it("recognizes only explicit missing-bucket responses", () => {
    const missing = Object.assign(new Error("missing"), {
      $metadata: { httpStatusCode: 404 },
    });

    expect(isMissingBucketError(missing)).toBe(true);
    expect(isMissingBucketError(Object.assign(new Error("denied"), { name: "AccessDenied" }))).toBe(
      false,
    );
    expect(isMissingBucketError(new Error("network unavailable"))).toBe(false);
  });
});
