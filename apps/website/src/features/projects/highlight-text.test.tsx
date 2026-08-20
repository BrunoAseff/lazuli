import { describe, expect, it } from "vitest";

import { getHighlightSegments } from "../../components/highlight-text.tsx";

describe("getHighlightSegments", () => {
  it("finds multiple matches without changing the original text", () => {
    expect(getHighlightSegments("Física e física", "fisica")).toEqual([
      { highlighted: true, text: "Física" },
      { highlighted: false, text: " e " },
      { highlighted: true, text: "física" },
    ]);
  });

  it("treats HTML and regular expression characters as ordinary text", () => {
    expect(getHighlightSegments("Projeto <script> [A-Z]", "<script>")).toContainEqual({
      highlighted: true,
      text: "<script>",
    });
    expect(getHighlightSegments("Projeto [A-Z]", "[A-Z]")).toContainEqual({
      highlighted: true,
      text: "[A-Z]",
    });
  });
});
