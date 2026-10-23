import { describe, it, expect } from "vitest";
import { createLifecycleEmail, lifecycleEmailKindSchema } from "./lifecycle-email.ts";

describe("lifecycle emails", () => {
  it("renders every event with shared identity and escaped user content", () => {
    for (const kind of lifecycleEmailKindSchema.options) {
      const message = createLifecycleEmail(
        kind,
        {
          name: '<script>alert("x")</script>',
          plan: "Essencial",
          effectiveAt: "2026-11-20T12:00:00Z",
        },
        "https://lazuli.example",
      );
      expect(message.html).not.toContain('<script>alert("x")</script>');
      expect(message.html).toContain("Lazúli");
      expect(message.subject).not.toMatch(/undefined|null/);
      expect(message.text.length).toBeGreaterThan(50);
    }
  });
  it("does not confuse cancellation scheduling with immediate loss of access", () => {
    const message = createLifecycleEmail(
      "cancellation_scheduled",
      { name: "Ana", effectiveAt: "2026-11-20T12:00:00Z" },
      "https://lazuli.example",
    );
    expect(message.text).toContain("continua até");
    expect(message.text).toContain("horário de Brasília");
  });
  it("confirms export delivery as an attachment rather than a download link", () => {
    const message = createLifecycleEmail("export_ready", { name: "Ana" }, "https://lazuli.example");
    expect(message.text).toContain("anexada");
    expect(message.html).not.toContain("https://lazuli.example");
  });
});
