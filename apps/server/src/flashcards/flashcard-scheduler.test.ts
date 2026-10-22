import { describe, expect, it } from "vitest";

import { previewFlashcardRatings, scheduleFlashcardReview } from "./flashcard-scheduler.ts";

const now = new Date("2026-08-23T12:00:00.000Z");
const fresh = {
  dueAt: now,
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  srsState: "new" as const,
  lastReviewedAt: null,
};

describe("flashcard scheduler", () => {
  it("previews all ratings deterministically and keeps due dates valid", () => {
    const first = previewFlashcardRatings(fresh, now);
    expect(first.map(({ rating }) => rating)).toEqual(["again", "hard", "good", "easy"]);
    expect(first).toEqual(previewFlashcardRatings(fresh, now));
    expect(first.every(({ dueAt }) => dueAt >= now)).toBe(true);
    expect(first[0]!.intervalSeconds).toBeLessThan(first[3]!.intervalSeconds);
  });

  it("persists distinct Again and Hard transitions", () => {
    const again = scheduleFlashcardReview(fresh, "again", now).schedule;
    const hard = scheduleFlashcardReview(fresh, "hard", now).schedule;
    expect(again.dueAt.getTime()).toBeLessThan(hard.dueAt.getTime());
    expect(again.reps).toBe(1);
    expect(hard.reps).toBe(1);
    expect(again.lastReviewedAt).toEqual(now);
  });

  it("schedules a mature card sooner when the desired retention is higher", () => {
    const mature = {
      ...fresh,
      difficulty: 5,
      dueAt: now,
      elapsedDays: 10,
      lastReviewedAt: new Date("2026-08-13T12:00:00.000Z"),
      reps: 5,
      scheduledDays: 10,
      srsState: "review" as const,
      stability: 10,
    };
    const lowerRetention = scheduleFlashcardReview(mature, "good", now, 80).schedule;
    const higherRetention = scheduleFlashcardReview(mature, "good", now, 95).schedule;

    expect(higherRetention.dueAt.getTime()).toBeLessThan(lowerRetention.dueAt.getTime());
  });
});
