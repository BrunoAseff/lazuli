import { DEFAULT_STUDY_GOAL, type StoneDayStatus } from "@lazuli/shared";
import { describe, expect, it } from "vitest";

import { buildStoneDays, goalOn, weekShine } from "./stone-queries.ts";

const available = (date: string, flashcards = true, quizzes = true) => ({
  date,
  flashcards,
  quizzes,
});

// 2026-11-16 is a Monday.
const week = ["16", "17", "18", "19", "20", "21", "22"].map((day) => `2026-11-${day}`);

describe("buildStoneDays", () => {
  it("judges each day by practices, days off, free days and today", () => {
    const days = buildStoneDays({
      accountDay: "2026-11-17",
      availability: week.map((date) => available(date, date !== "2026-11-19", false)),
      events: [
        { day: "2026-11-17", kind: "flashcards" },
        { day: "2026-11-17", kind: "quizzes" },
        { day: "2026-11-18", kind: "flashcards" },
      ],
      from: "2026-11-16",
      goals: [
        {
          effectiveFrom: "2026-11-01",
          counts: "both",
          practices: 2,
          days: [true, true, true, true, true, false, true],
        },
      ],
      today: "2026-11-22",
    });
    expect(days.map(({ status }) => status)).toEqual([
      "none",
      "met",
      "missed",
      "free",
      "missed",
      "off",
      "open",
    ]);
  });

  it("counts only the kind the goal asks for", () => {
    const [day] = buildStoneDays({
      accountDay: "2026-01-01",
      availability: [available("2026-11-16")],
      events: [{ day: "2026-11-16", kind: "quizzes" }],
      from: "2026-11-16",
      goals: [
        { effectiveFrom: "2026-01-01", ...DEFAULT_STUDY_GOAL, counts: "flashcards", practices: 1 },
      ],
      today: "2026-11-17",
    });
    expect(day).toEqual({ date: "2026-11-16", practices: 0, status: "missed" });
  });

  it("keeps past days under the goal they had", () => {
    const goals = [
      { effectiveFrom: "2026-11-01", ...DEFAULT_STUDY_GOAL, practices: 1 },
      { effectiveFrom: "2026-11-17", ...DEFAULT_STUDY_GOAL, practices: 3 },
    ];
    expect(goalOn(goals, "2026-11-16").practices).toBe(1);
    expect(goalOn(goals, "2026-11-17").practices).toBe(3);
    expect(goalOn([], "2026-11-17")).toEqual(DEFAULT_STUDY_GOAL);
  });
});

describe("weekShine", () => {
  const day = (status: StoneDayStatus) => ({
    date: "2026-11-16",
    practices: 0,
    status,
  });

  it("shines with four studied days and dulls with fewer", () => {
    expect(
      weekShine(
        (["met", "met", "free", "met", "missed", "missed", "open"] as StoneDayStatus[]).map(day),
      ),
    ).toEqual({
      studied: 4,
      dull: 0,
    });
    expect(
      weekShine(
        (["met", "missed", "missed", "missed", "missed", "missed", "open"] as StoneDayStatus[]).map(
          day,
        ),
      ),
    ).toEqual({ studied: 1, dull: 0.75 });
  });

  it("asks fewer days when most are days off, and the same of a new account", () => {
    expect(
      weekShine((["off", "off", "off", "off", "met", "met", "off"] as StoneDayStatus[]).map(day))
        .dull,
    ).toBe(0);
    expect(
      weekShine(
        (["none", "none", "none", "none", "none", "none", "open"] as StoneDayStatus[]).map(day),
      ).dull,
    ).toBe(1);
  });
});
