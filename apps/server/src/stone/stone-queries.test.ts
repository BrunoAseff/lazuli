import { DEFAULT_STUDY_GOAL, type StoneDayStatus } from "@lazuli/shared";
import { describe, expect, it } from "vitest";

import { buildStoneDays, weekShine } from "./stone-queries.ts";

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
      goal: {
        counts: "both",
        practices: 2,
        days: [true, true, true, true, true, false, true],
      },
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
      goal: { ...DEFAULT_STUDY_GOAL, counts: "flashcards", practices: 1 },
      today: "2026-11-17",
    });
    expect(day).toEqual({ date: "2026-11-16", practices: 0, status: "missed", studyDay: true });
  });

  it("judges past days by the current goal too, so an edit shows at once", () => {
    const [day] = buildStoneDays({
      accountDay: "2026-01-01",
      availability: [available("2026-11-16")],
      events: [{ day: "2026-11-16", kind: "flashcards" }],
      from: "2026-11-16",
      goal: { ...DEFAULT_STUDY_GOAL, practices: 1 },
      today: "2026-11-17",
    });
    expect(day?.status).toBe("met");
  });
});

describe("weekShine", () => {
  const day = (status: StoneDayStatus) => ({
    date: "2026-11-16",
    practices: 0,
    status,
    studyDay: status !== "off",
  });
  const week = (statuses: StoneDayStatus[]) => weekShine(statuses.map(day));

  it("is the share of study days that kept the goal", () => {
    expect(week(["met", "met", "free", "missed", "off", "off", "open"])).toEqual({
      kept: 3,
      planned: 4,
      dull: 0.25,
    });
  });

  it("counts neither days off, days before the account nor today while open", () => {
    expect(week(["none", "none", "off", "met", "off", "off", "open"])).toEqual({
      kept: 1,
      planned: 1,
      dull: 0,
    });
    expect(week(["none", "none", "none", "none", "none", "none", "open"]).dull).toBe(0);
    // Studying on a day off shows as studied, but does not add a study day.
    expect(weekShine([{ ...day("met"), studyDay: false }, day("missed")])).toEqual({
      kept: 0,
      planned: 1,
      dull: 1,
    });
  });
});
