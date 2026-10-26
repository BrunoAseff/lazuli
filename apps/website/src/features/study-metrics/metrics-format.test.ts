import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatRate,
  validRange,
  presetRange,
  formatFullDate,
  formatChartDate,
  metricsPlotMinWidth,
} from "./metrics-format.ts";
afterEach(() => vi.useRealTimers());
describe("study metrics presentation", () => {
  it("labels all monthly buckets with months only, including a twelve-month range", () => {
    for (const date of ["2026-08-03", "2026-08-17", "2025-12-15", "2026-01-01"]) {
      expect(formatChartDate(date, "month")).not.toMatch(/\d/);
    }
    expect(formatChartDate("2026-08-03", "month")).toBe("ago.");
    expect(formatChartDate("2026-10-22", "day")).toBe("22\nout.");
    expect(formatChartDate("2026-10-22", "week")).toBe("22\nout.");
  });
  it("reserves room for every tick instead of silently hiding categories", () => {
    for (const count of [1, 7, 9, 13, 14]) {
      expect(metricsPlotMinWidth(count)).toBeGreaterThanOrEqual(count * 30 + 48);
      expect(metricsPlotMinWidth(count)).toBeGreaterThanOrEqual(240);
    }
  });
  it("distinguishes an empty denominator from a real zero", () => {
    expect(formatRate(0, 0)).toBe("Sem dados");
    expect(formatRate(0, 4)).toBe("0%");
    expect(formatRate(4, 4)).toBe("100%");
  });
  it("shows a weighted fraction instead of an average of percentages", () => {
    expect(formatRate(1, 10)).toBe("10%");
  });
  it("rejects dates that JavaScript would silently normalize", () => {
    expect(validRange("2026-02-30", "2026-03-01")).toBe(false);
    expect(validRange("garbage", "2026-03-01")).toBe(false);
    expect(validRange("2026-02-01", "2026-01-01")).toBe(false);
  });
  it("includes today in presets and shows the year in precise dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));
    expect(presetRange(7)).toEqual({ from: "2026-10-18", to: "2026-10-24" });
    expect(formatFullDate("2026-10-24")).toContain("2026");
  });
  it("keeps the twelve-month preset on calendar boundaries across leap years", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-29T15:00:00Z"));
    expect(presetRange(365)).toEqual({ from: "2023-03-01", to: "2024-02-29" });
    vi.setSystemTime(new Date("2025-02-28T15:00:00Z"));
    expect(presetRange(365)).toEqual({ from: "2024-02-29", to: "2025-02-28" });
  });
});
