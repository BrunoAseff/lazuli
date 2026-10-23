import { describe, expect, it } from "vitest";

import { createCsv } from "./account-export-worker.ts";

describe("account export CSV", () => {
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
