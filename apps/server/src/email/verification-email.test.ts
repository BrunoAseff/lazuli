import { describe, expect, it } from "vitest";

import { createVerificationEmail } from "./verification-email.ts";

describe("createVerificationEmail", () => {
  it("creates Portuguese text and never carries the name chosen at sign-up", () => {
    const email = createVerificationEmail({
      name: '<script>alert("x")</script>',
      url: "https://example.com/verify?token=a&next=b",
    });

    expect(email.subject).toBe("Confirme seu e-mail no Lazúli");
    expect(email.text).toContain("Confirme seu e-mail");
    expect(email.html).not.toContain("script");
    expect(email.text).not.toContain("script");
    expect(email.html).toContain("token=a&amp;next=b");
    expect(email.html).toContain("Se o botão não funcionar");
    expect(email.html).toContain("border-radius:14px");
  });
});
