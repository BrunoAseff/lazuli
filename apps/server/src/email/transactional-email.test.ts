import { describe, expect, it } from "vitest";

import { createTransactionalEmailHtml, escapeEmailHtml } from "./transactional-email.ts";

describe("transactional email", () => {
  it("escapes every attribute-sensitive character", () => {
    expect(escapeEmailHtml(`<a href='"&'>`)).toBe("&lt;a href=&#39;&quot;&amp;&#39;&gt;");
  });

  it("renders shared branding, action and a visible fallback URL", () => {
    const html = createTransactionalEmailHtml({
      action: { href: "https://example.com/?a=1&b=2", label: "Continuar" },
      childrenHtml: "<p>Conteúdo confiável</p>",
      footerHtml: "Rodapé confiável",
      preheader: "Prévia",
      title: "Título",
    });

    expect(html).toContain("Lazúli");
    expect(html).toContain("Continuar");
    expect(html).toContain("https://example.com/?a=1&amp;b=2");
    expect(html).toContain("Se o botão não funcionar");
    expect(html).toContain("Conteúdo confiável");
    expect(html).toContain('align="center" cellspacing="0"');
    expect(html).toContain("margin:28px auto 26px");
    expect(html).toContain("background:#f2edee");
    expect(html).toContain("background:#fffefd");
  });
});
