// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useSearchParams } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { StudyCollectionToolbar } from "./study-collection-toolbar.tsx";
import { FavoriteFilterMenu } from "@/features/favorites/favorite-filter.tsx";

vi.mock("./project-filter.tsx", () => ({ ProjectFilter: () => null }));
afterEach(() => vi.unstubAllGlobals());

it("shows the same count for favorites in projects and collections, and clears it when the filter is removed", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const Fixture = () => {
    const [, setParams] = useSearchParams();
    return (
      <>
        <FavoriteFilterMenu />
        <StudyCollectionToolbar
          project={undefined}
          status="active"
          searchValue=""
          onClearSearch={vi.fn()}
          onProjectChange={vi.fn()}
          onSearchChange={vi.fn()}
          onStatusChange={vi.fn()}
        />
        <button onClick={() => setParams({})}>Limpar</button>
      </>
    );
  };
  try {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/?favorites=only"]}>
          <Fixture />
        </MemoryRouter>,
      ),
    );
    for (const name of ["Filtrar projetos (1 ativo)", "Filtrar coleções (1 ativo)"]) {
      const button = host.querySelector(`button[aria-label="${name}"]`)!;
      expect(button).not.toBeNull();
      expect(button.querySelector("span[aria-hidden=true]")?.textContent).toBe("1");
    }
    await act(async () =>
      Array.from(host.querySelectorAll("button"))
        .find((button) => button.textContent === "Limpar")!
        .click(),
    );
    for (const name of ["Filtrar projetos", "Filtrar coleções"]) {
      const button = host.querySelector(`button[aria-label="${name}"]`)!;
      expect(button).not.toBeNull();
      expect(button.querySelector("span[aria-hidden=true]")).toBeNull();
    }
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
