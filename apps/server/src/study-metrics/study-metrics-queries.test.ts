import { STUDY_METRICS_MIN_RANK } from "@lazuli/shared";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { QueryExecutor } from "../database/client.ts";
import { getStudyRanking } from "./study-metrics-queries.ts";

describe("ranking empty-state qualification", () => {
  it.each(["flashcards", "quizzes"] as const)(
    "uses the shared minimum rank for %s",
    async (view) => {
      const execute = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ practice: 4, qualified: 0, matching: 0, failures: 1 }]);
      const result = await getStudyRanking(
        { execute } as unknown as QueryExecutor,
        "user-1",
        {
          from: "2026-10-01",
          to: "2026-10-24",
          tz: "UTC",
          compare: "false",
          page: 1,
          includeArchived: "false",
          order: "errors",
        },
        view,
      );
      const query = new PgDialect().sqlToQuery(execute.mock.calls[1]![0]);
      const qualification =
        view === "flashcards"
          ? /having count\(\*\)>=\$(\d+)/
          : /having count\(distinct attempt_id\)>=\$(\d+)/;
      const parameter = query.sql.match(qualification)?.[1];
      expect(parameter).toBeDefined();
      expect(query.params[Number(parameter) - 1]).toBe(STUDY_METRICS_MIN_RANK);
      expect(result.emptyReason).toBe("initial");
    },
  );
});
