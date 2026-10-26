import { describe, it, expect } from "vitest";
import {
  groupMetricsDays,
  localToday,
  shiftDate,
  validateMetricsRange,
  alignPreviousDays,
  comparisonWindow,
  localWallInstant,
} from "./metrics-calendar.ts";
import type { StudyMetricsPoint } from "@lazuli/shared";
const point = (date: string, eligible = 0, remembered = 0): StudyMetricsPoint => ({
  date,
  end: date,
  eligible,
  remembered,
  evaluations: eligible,
  again: eligible - remembered,
  hard: 0,
  good: remembered,
  easy: 0,
  quizAnswers: 0,
  quizCorrect: 0,
});
describe("study metrics calendar", () => {
  it("groups ninety days and long custom ranges by calendar month", () => {
    for (const length of [61, 90, 120]) {
      const grouped = groupMetricsDays(
        Array.from({ length }, (_, i) => point(shiftDate("2026-07-29", i), 1, 1)),
      );
      expect(grouped.bucket).toBe("month");
      expect(grouped.series.reduce((sum, p) => sum + p.evaluations, 0)).toBe(length);
      expect(grouped.series.map((p) => p.date.slice(0, 7))).toEqual([
        ...new Set(grouped.series.map((p) => p.date.slice(0, 7))),
      ]);
    }
  });
  it("groups a thirty-day view by week without losing reviews", () => {
    const grouped = groupMetricsDays(
      Array.from({ length: 30 }, (_, i) => point(shiftDate("2026-09-27", i), 1, 1)),
    );
    expect(grouped.bucket).toBe("week");
    expect(grouped.series.reduce((sum, p) => sum + p.eligible, 0)).toBe(30);
  });
  it("compares today's progress against the same local wall time", () => {
    const window = comparisonWindow(
      "2026-10-20",
      "2026-10-26",
      "America/Sao_Paulo",
      new Date("2026-10-26T15:23:45Z"),
    );
    expect(window.previousFrom).toBe("2026-10-13");
    expect(window.previousTo).toBe("2026-10-19");
    expect(window.previousCutoff).toBe("2026-10-19T15:23:45.000Z");
    expect(window.currentCutoff).toBe("2026-10-26T15:23:45.000Z");
    expect(
      comparisonWindow(
        "2026-10-20",
        "2026-10-26",
        "America/Sao_Paulo",
        new Date("2026-10-26T15:23:45.123Z"),
      ).previousCutoff,
    ).toBe("2026-10-19T15:23:45.123Z");
  });
  it("does not cut completed historical periods at the current time of day", () => {
    const window = comparisonWindow(
      "2026-10-01",
      "2026-10-07",
      "America/Sao_Paulo",
      new Date("2026-10-26T15:00:00Z"),
    );
    expect(window.currentCutoff).toBeUndefined();
    expect(window.previousCutoff).toBeUndefined();
    expect(window.previousTo).toBe("2026-09-30");
  });
  it("uses the first occurrence in a DST fold and first valid instant after a gap", () => {
    expect(localWallInstant("2026-11-01", "01:30:00", "America/New_York").toISOString()).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    expect(localWallInstant("2026-03-08", "02:30:45", "America/New_York").toISOString()).toBe(
      "2026-03-08T07:00:00.000Z",
    );
  });
  it("aligns unequal months using equal local-day offsets and keeps every observation", () => {
    const days = Array.from({ length: 125 }, (_, i) => point(shiftDate("2025-11-20", i), 1, 1));
    const current = groupMetricsDays(days).series;
    const previous = Array.from({ length: 125 }, (_, i) => point(shiftDate("2025-07-18", i), 2, 1));
    const aligned = alignPreviousDays(current, previous, 125);
    expect(aligned.reduce((sum, p) => sum + p.eligible, 0)).toBe(250);
    expect(aligned[0]!.date).toBe("2025-07-18");
    expect(aligned[0]!.end).toBe("2025-07-28");
    expect(current[0]!.eligible).toBe(11);
  });
  it("uses the user's calendar rather than UTC near midnight", () => {
    expect(localToday("America/Sao_Paulo", new Date("2026-10-23T01:30:00Z"))).toBe("2026-10-22");
    expect(localToday("Asia/Tokyo", new Date("2026-10-23T22:30:00Z"))).toBe("2026-10-24");
  });
  it("shifts calendar dates over leap years and DST without shifting the day", () => {
    expect(shiftDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDate("2026-03-08", 1)).toBe("2026-03-09");
  });
  it("rejects reversed, future, invalid and unbounded date ranges", () => {
    expect(validateMetricsRange("2026-10-10", "2026-10-01", "UTC")).toBe(false);
    expect(validateMetricsRange("2026-01-01", "2099-01-01", "UTC")).toBe(false);
    expect(validateMetricsRange("2026-10-01", "2026-10-10", "Not/AZone")).toBe(false);
    expect(validateMetricsRange("2024-01-01", "2026-01-01", "UTC")).toBe(false);
    expect(validateMetricsRange("2026-02-30", "2026-03-01", "UTC")).toBe(false);
    expect(validateMetricsRange("2026-01-01", "2026-01-01", "UTC")).toBe(true);
  });
  it("sums denominators, never daily percentages, and does not mutate input", () => {
    const points = Array.from({ length: 40 }, (_, i) =>
      point(shiftDate("2026-01-01", i), i === 0 ? 1 : i === 1 ? 9 : 0, i === 0 ? 1 : 0),
    );
    const grouped = groupMetricsDays(points);
    expect(grouped.bucket).toBe("week");
    expect(grouped.series[0]!.eligible).toBe(10);
    expect(grouped.series[0]!.remembered).toBe(1);
    expect(points[0]!.eligible).toBe(1);
    expect(grouped.series[0]!.date).toBe("2026-01-01");
    expect(grouped.series[0]!.end).toBe("2026-01-04");
  });
  it("groups long intervals by month and keeps partial bounds", () => {
    const grouped = groupMetricsDays(
      Array.from({ length: 125 }, (_, i) => point(shiftDate("2025-11-20", i))),
    );
    expect(grouped.bucket).toBe("month");
    expect(grouped.series[0]!.date).toBe("2025-11-20");
    expect(grouped.series[0]!.end).toBe("2025-11-30");
    expect(grouped.series.at(-1)!.end).toBe(shiftDate("2025-11-20", 124));
  });
});
