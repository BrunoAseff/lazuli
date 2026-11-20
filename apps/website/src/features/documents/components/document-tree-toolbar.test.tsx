import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocumentTreeToolbar } from "./document-tree-toolbar.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";

const renderToolbar = () =>
  renderToStaticMarkup(
    <TooltipProvider>
      <DocumentTreeToolbar
        onCreate={vi.fn()}
        onImport={vi.fn()}
        onSearchChange={vi.fn()}
        search=""
      />
    </TooltipProvider>,
  );

describe("DocumentTreeToolbar", () => {
  it("shows import beside the normal tree actions", () => {
    const markup = renderToolbar();

    expect(markup).toContain('aria-label="Importar documentos"');
    expect(markup).toContain('aria-label="Nova pasta"');
    expect(markup).toContain("Novo documento");
  });

  it("keeps search visible alongside creation and import, without a search mode", () => {
    const markup = renderToolbar();

    expect(markup).toContain('placeholder="Pesquisar arquivos"');
    expect(markup).toContain('aria-label="Importar documentos"');
    expect(markup).not.toContain('aria-label="Fechar pesquisa"');
  });

  it("does not autofocus search when opening a project", () => {
    expect(renderToolbar()).not.toContain("autofocus");
  });
});
