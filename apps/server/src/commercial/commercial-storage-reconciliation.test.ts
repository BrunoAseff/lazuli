import { describe, expect, it } from "vitest";

import { findStorageDivergences } from "./commercial-storage-reconciliation.ts";

describe("commercial storage reconciliation", () => {
  it("reports only accounts whose asset or active-upload totals diverge", () => {
    expect(
      findStorageDivergences(
        ["consistent", "missing", "stale"],
        new Map([
          ["consistent", 150],
          ["missing", 25],
        ]),
        new Map([["consistent", 50]]),
        new Map([
          ["consistent", { usedBytes: 150, reservedBytes: 50 }],
          ["stale", { usedBytes: 80, reservedBytes: 10 }],
        ]),
      ),
    ).toEqual([
      {
        userId: "missing",
        recordedUsedBytes: 0,
        expectedUsedBytes: 25,
        recordedReservedBytes: 0,
        expectedReservedBytes: 0,
      },
      {
        userId: "stale",
        recordedUsedBytes: 80,
        expectedUsedBytes: 0,
        recordedReservedBytes: 10,
        expectedReservedBytes: 0,
      },
    ]);
  });

  it("does not count PostgreSQL document JSON as user storage", () => {
    expect(findStorageDivergences(["user"], new Map(), new Map(), new Map())).toEqual([]);
  });
});
