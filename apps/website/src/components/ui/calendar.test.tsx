import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Calendar } from "./calendar.tsx";

it("draws the date range on cells without offset pseudo-element borders", () => {
  const markup = renderToStaticMarkup(
    <Calendar
      mode="range"
      defaultMonth={new Date(2026, 10, 1)}
      selected={{ from: new Date(2026, 10, 19), to: new Date(2026, 10, 22) }}
    />,
  );
  expect(markup).toContain('data-range-start="true"');
  expect(markup).toContain('data-range-end="true"');
  expect(markup).toContain("ring-inset");
  expect(markup).not.toContain("after:absolute");
  expect(markup).not.toContain("after:inset");
});
