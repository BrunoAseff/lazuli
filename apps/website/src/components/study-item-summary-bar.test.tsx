import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StudyIndexTools } from "./study-index.tsx";
import { StudyItemSummaryBar } from "./study-item-summary-bar.tsx";
import { TooltipProvider } from "./ui/tooltip.tsx";

const props = {
  itemLabel: { singular: "questão selecionada", plural: "questões selecionadas" },
  onClear: () => {},
  onDelete: () => {},
  onToggleArchive: () => {},
  status: "active" as const,
};

const render = (selecting: boolean) =>
  renderToStaticMarkup(
    <TooltipProvider>
      <StudyIndexTools
        selecting={selecting}
        selection={<StudyItemSummaryBar {...props} count={2} />}
      >
        <input aria-label="Buscar questões" />
      </StudyIndexTools>
    </TooltipProvider>,
  );

it("keeps search in place while nothing is selected", () => {
  const markup = render(false);
  expect(markup).toContain("Buscar questões");
  expect(markup).not.toContain("Desmarcar");
});

it("replaces search with batch actions in the same row while items are selected", () => {
  const markup = render(true);
  expect(markup).toContain("questões selecionadas");
  expect(markup).toContain("Excluir selecionados");
  expect(markup).toContain("Desmarcar");
  expect(markup).not.toContain("Buscar questões");
});
