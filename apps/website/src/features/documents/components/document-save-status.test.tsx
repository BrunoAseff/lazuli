import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocumentSaveStatus, type DocumentSaveState } from "./document-save-status.tsx";

const render = (state: DocumentSaveState) =>
  renderToStaticMarkup(
    <DocumentSaveStatus onOpenConflict={vi.fn()} onRetry={vi.fn()} state={state} />,
  );

describe("DocumentSaveStatus", () => {
  it("reserves the same slot for every save state instead of sizing to the label", () => {
    for (const state of ["saved", "pending", "saving", "error", "conflict"] as const) {
      expect(render(state)).toContain("relative h-8 w-8 shrink-0");
      expect(render(state)).toContain("sm:w-44");
      expect(render(state)).toContain("absolute inset-0");
    }
  });
  it.each([
    ["saved", "Alterações salvas"],
    ["pending", "Alterações não salvas"],
    ["saving", "Salvando…"],
    ["error", "Erro ao salvar · Tentar novamente"],
    ["conflict", "Conflito de edição"],
  ] as const)("renders the %s state in Portuguese", (state, label) => {
    expect(render(state)).toContain(label);
  });
});
