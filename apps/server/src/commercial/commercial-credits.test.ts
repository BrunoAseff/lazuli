import { describe, expect, it } from "vitest";

import { getAnchoredMonthlyPeriod } from "./commercial-credits.ts";

describe("commercial monthly periods", () => {
  it("renews on the account creation day", () => {
    expect(
      getAnchoredMonthlyPeriod(
        new Date("2026-01-12T15:30:00.000Z"),
        new Date("2026-10-15T09:00:00.000Z"),
      ),
    ).toEqual({
      start: new Date("2026-10-12T00:00:00.000Z"),
      end: new Date("2026-11-12T00:00:00.000Z"),
    });
  });

  it("clamps end-of-month anchors without drifting into later periods", () => {
    const accountCreatedAt = new Date("2024-01-31T15:30:00.000Z");

    expect(
      getAnchoredMonthlyPeriod(accountCreatedAt, new Date("2024-02-29T12:00:00.000Z")),
    ).toEqual({
      start: new Date("2024-02-29T00:00:00.000Z"),
      end: new Date("2024-03-31T00:00:00.000Z"),
    });
    expect(
      getAnchoredMonthlyPeriod(accountCreatedAt, new Date("2026-02-28T12:00:00.000Z")),
    ).toEqual({
      start: new Date("2026-02-28T00:00:00.000Z"),
      end: new Date("2026-03-31T00:00:00.000Z"),
    });
  });

  it("keeps the previous period before this month's anchor", () => {
    expect(
      getAnchoredMonthlyPeriod(
        new Date("2026-01-20T15:30:00.000Z"),
        new Date("2026-10-19T23:59:59.000Z"),
      ),
    ).toEqual({
      start: new Date("2026-09-20T00:00:00.000Z"),
      end: new Date("2026-10-20T00:00:00.000Z"),
    });
  });
});
