import { describe, expect, it } from "vitest";

import { createPasswordResetEmail } from "./password-reset-email.ts";

describe("createPasswordResetEmail", () => {
  it("creates a Portuguese single-use reset message and escapes user content", () => {
    const email = createPasswordResetEmail({
      name: '<script>alert("x")</script>',
      url: "https://example.com/reset?token=a&next=b",
    });

    expect(email.subject).toBe("Redefina sua senha no Lazúli");
    expect(email.text).toContain("Use este link para definir uma nova senha");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("token=a&amp;next=b");
    expect(email.html).toContain("pode ser usado apenas uma vez");
  });
});
