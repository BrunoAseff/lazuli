import { describe, expect, it } from "vitest";

import { createVerificationEmail } from "./verification-email.ts";

describe("createVerificationEmail", () => {
  it("creates Portuguese text and escapes user-controlled HTML", () => {
    const email = createVerificationEmail({
      name: '<script>alert("x")</script>',
      url: "https://example.com/verify?token=a&next=b",
    });

    expect(email.subject).toBe("Confirme seu e-mail no Lazúli");
    expect(email.text).toContain("Confirme seu e-mail");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("token=a&amp;next=b");
  });
});
