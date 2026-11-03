import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchInput } from "./search-input.tsx";

describe("SearchInput clear space", () => {
  it.each([
    { value: "", alwaysShowClear: false, padding: "pr-3", clear: false },
    { value: "texto", alwaysShowClear: false, padding: "pr-9", clear: true },
    { value: "", alwaysShowClear: true, padding: "pr-9", clear: true },
  ])("reserves clear space only when visible: $value / $alwaysShowClear", (props) => {
    const markup = renderToStaticMarkup(
      <SearchInput
        value={props.value}
        alwaysShowClear={props.alwaysShowClear}
        onValueChange={() => {}}
      />,
    );
    expect(markup).toContain(props.padding);
    expect(markup.includes('aria-label="Limpar pesquisa"')).toBe(props.clear);
  });
});
