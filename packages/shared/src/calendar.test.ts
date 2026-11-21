import { describe, expect, it } from "vitest";

import { dateKeyIn, normalizeTimeZone, shiftDateKey } from "./calendar.ts";

describe("calendar days", () => {
  it("reads the day an instant falls on in the person's time zone", () => {
    const night = new Date("2026-10-23T01:30:00Z");
    expect(dateKeyIn(night, "America/Sao_Paulo")).toBe("2026-10-22");
    expect(dateKeyIn(night, "Asia/Tokyo")).toBe("2026-10-23");
  });

  it("moves across months and leap days", () => {
    expect(shiftDateKey("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("accepts real zones only", () => {
    expect(normalizeTimeZone()).toBe("UTC");
    expect(normalizeTimeZone("America/Sao_Paulo")).toBe("America/Sao_Paulo");
    expect(normalizeTimeZone("Not/AZone")).toBeNull();
  });
});
