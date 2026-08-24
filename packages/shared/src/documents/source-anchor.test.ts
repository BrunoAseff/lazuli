import { describe, expect, it } from "vitest";

import { readSourceAnchorId, sourceAnchorIdSchema } from "./source-anchor.ts";

describe("sourceAnchor embedded style", () => {
  it("accepts a stable anchor identifier embedded in inline text styles", () => {
    expect(sourceAnchorIdSchema.parse("anchor-stable")).toBe("anchor-stable");
    expect(readSourceAnchorId({ bold: true, sourceAnchor: "anchor-stable" })).toBe("anchor-stable");
  });

  it("does not create an external offset-based reference", () => {
    expect(readSourceAnchorId({ sourceAnchor: 42 })).toBeNull();
    expect(readSourceAnchorId({})).toBeNull();
  });
});
