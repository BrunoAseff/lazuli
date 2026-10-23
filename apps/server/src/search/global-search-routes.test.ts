import { describe, it, expect } from "vitest";
import { buildSearchTerms } from "./global-search-routes.ts";

describe("global search terms", () => {
  it("normalizes accents and prevents user text from injecting tsquery operators", () => {
    expect(buildSearchTerms("Coordenação & memória: !' OR <script>")).toBe(
      "coordenacao:* & memoria:* & or:* & script:*",
    );
    expect(buildSearchTerms("---")).toBe("");
    expect(buildSearchTerms("中文 revisão")).toBe("中文:* & revisao:*");
  });
});
