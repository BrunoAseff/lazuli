import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocumentTreeToolbar } from "./document-tree-toolbar.tsx";

const renderToolbar = (searchOpen: boolean) =>
  renderToStaticMarkup(
    <DocumentTreeToolbar
      closeIcon="panel"
      onCreate={vi.fn()}
      onImport={vi.fn()}
      onSearchChange={vi.fn()}
      onSearchOpenChange={vi.fn()}
      search=""
      searchOpen={searchOpen}
    />,
  );

describe("DocumentTreeToolbar", () => {
  it("shows import beside the normal tree actions", () => {
    const markup = renderToolbar(false);

    expect(markup).toContain('aria-label="Importar documentos"');
    expect(markup).toContain('aria-label="Nova pasta"');
    expect(markup).toContain('aria-label="Novo documento"');
  });

  it("uses the complete width for search while it is open", () => {
    const markup = renderToolbar(true);

    expect(markup).toContain('placeholder="Pesquisar arquivos"');
    expect(markup).not.toContain('aria-label="Importar documentos"');
  });
});
