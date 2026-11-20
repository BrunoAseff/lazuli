import { expect, it } from "vitest";
import { formatRecent, formatUpcoming, formatUpdated } from "./date-format.ts";

it("names near moments by day and keeps the rest short", () => {
  const now = new Date(2026, 10, 18, 9, 0);
  expect(formatUpcoming(new Date(2026, 10, 18, 10, 15), now)).toBe("hoje, 10:15");
  expect(formatUpcoming(new Date(2026, 10, 19, 8, 0), now)).toBe("amanhã, 08:00");
  expect(formatUpcoming(new Date(2026, 10, 24, 14, 23), now)).toMatch(/^24 de nov\.?,? 14:23$/);
});

it("names recent days and drops the current year", () => {
  const now = new Date(2026, 10, 18, 15, 0);
  expect(formatRecent(new Date(2026, 10, 18, 9, 0), now)).toBe("hoje");
  expect(formatRecent(new Date(2026, 10, 17, 22, 0), now)).toBe("ontem");
  expect(formatRecent(new Date(2026, 9, 7), now)).toMatch(/^7 de out\.?$/);
  expect(formatRecent(new Date(2025, 9, 7), now)).toMatch(/2025/);
});

it("phrases the last update", () => {
  const now = new Date(2026, 10, 18, 15, 0);
  expect(formatUpdated(new Date(2026, 10, 18, 9, 0), now)).toBe("Atualizado hoje");
  expect(formatUpdated(new Date(2026, 9, 7), now)).toMatch(/^Atualizado em 7 de out/);
});
