import { describe, expect, it } from "vitest";

import { getImagePresentation } from "./image-presentation.ts";

describe("document image presentation", () => {
  it("keeps a stable loading state until the protected URL is resolved", () => {
    expect(getImagePresentation(false, { loadingState: "loading" })).toEqual({ kind: "loading" });
  });

  it("shows the image only after URL resolution succeeds", () => {
    expect(
      getImagePresentation(false, { loadingState: "loaded", downloadUrl: "blob:resolved" }),
    ).toEqual({ kind: "ready", source: "blob:resolved" });
  });

  it("shows an error only after resolution or loading fails terminally", () => {
    expect(getImagePresentation(false, { loadingState: "error" })).toEqual({ kind: "error" });
    expect(
      getImagePresentation(
        false,
        { loadingState: "loaded", downloadUrl: "blob:failed" },
        "blob:failed",
      ),
    ).toEqual({ kind: "error" });
  });
});
