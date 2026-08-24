import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocumentSaveStatus, type DocumentSaveState } from "./document-save-status.tsx";

const render = (state: DocumentSaveState) =>
  renderToStaticMarkup(
    <DocumentSaveStatus onOpenConflict={vi.fn()} onRetry={vi.fn()} state={state} />,
  );

describe("DocumentSaveStatus", () => {
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
