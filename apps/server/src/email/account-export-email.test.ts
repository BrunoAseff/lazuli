import { describe, expect, it } from "vitest";

import { createAccountExportEmail } from "./account-export-email.ts";

describe("account export email", () => {
  it("explains that the readable copy is attached without creating a download link", () => {
    const email = createAccountExportEmail({ name: "Bruno" });

    expect(email.text).toContain("anexada a este e-mail");
    expect(email.text).toContain("arquivos CSV");
    expect(email.html).not.toContain("href=");
  });
});
