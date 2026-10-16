import { describe, expect, it } from "vite-plus/test";

import { exceedsCommercialLimit } from "./commercial-limit-enforcement.ts";

describe("commercial limit enforcement", () => {
  it("blocks only usage above the limit when enforcement is enabled", () => {
    expect(exceedsCommercialLimit(true, 501, 500)).toBe(true);
    expect(exceedsCommercialLimit(true, 500, 500)).toBe(false);
  });

  it("keeps the additive rollout non-blocking while enforcement is disabled", () => {
    expect(exceedsCommercialLimit(false, 501, 500)).toBe(false);
  });
});
