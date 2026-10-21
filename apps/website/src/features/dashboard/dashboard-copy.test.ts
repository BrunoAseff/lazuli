import { describe, expect, it } from "vitest";

import { getDashboardGreeting } from "./dashboard-copy.ts";

describe("dashboard copy", () => {
  it("uses the local period and a safe fallback", () => {
    expect(getDashboardGreeting("Ana Silva", 9)).toBe("Bom dia, Ana");
    expect(getDashboardGreeting("Ana Silva", 14)).toBe("Boa tarde, Ana");
    expect(getDashboardGreeting("Ana Silva", 21)).toBe("Boa noite, Ana");
    expect(getDashboardGreeting("   ", 9)).toBe("Olá");
  });
});
