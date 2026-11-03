import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Database } from "../database/client.ts";

import { createAnalyticsConsentCsv, createCsv } from "./account-export-worker.ts";

describe("account export CSV", () => {
  it("streams consent events in bounded, owned keyset pages with one CSV header", async () => {
    const row = (index: number) => ({
      id: String(index).padStart(4, "0"),
      userId: "owner",
      status: "denied",
      version: 1,
      decidedAt: new Date("2026-10-01T00:00:00Z"),
    });
    const limit = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => row(i)))
      .mockResolvedValueOnce([row(500)]);
    const where = vi.fn();
    const query = { from: vi.fn(), where, orderBy: vi.fn(), limit };
    query.from.mockReturnValue(query);
    where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    const database = { select: vi.fn(() => query) } as unknown as Database;
    const iterator = createAnalyticsConsentCsv(database, "owner");
    const header = await iterator.next();
    expect(limit).not.toHaveBeenCalled();
    const chunks: string[] = [header.value!];
    for await (const chunk of iterator) chunks.push(chunk);
    expect(chunks).toHaveLength(502);
    expect(chunks.join("").match(/"decidedAt"/g)).toHaveLength(1);
    expect(chunks[1]).toContain('"0000","owner","denied","1","2026-10-01T00:00:00.000Z"');
    expect(chunks.at(-1)).toContain('"0500"');
    expect(limit.mock.calls).toEqual([[500], [500]]);
    const secondPage = new PgDialect().sqlToQuery(where.mock.calls[1]![0]);
    expect(secondPage.sql).toContain('"analytics_consent_event"."user_id" =');
    expect(secondPage.sql).toContain('"analytics_consent_event"."id" >');
    expect(secondPage.params).toEqual(["owner", "0499"]);
  });
  it("creates a spreadsheet-friendly table with nested fields and escaped values", () => {
    const csv = createCsv([
      { active: true, name: 'Coleção "Importante"', settings: { retention: 90 } },
      { active: false, name: "Revisão, final", settings: { retention: 85 } },
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"active","name","settings.retention"');
    expect(csv).toContain('"Sim","Coleção ""Importante""","90"');
    expect(csv).toContain('"Não","Revisão, final","85"');
    expect(csv).not.toContain("[object Object]");
  });
});
