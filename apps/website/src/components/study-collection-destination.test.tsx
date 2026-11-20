import type { ReactNode } from "react";
// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StudyCollectionDestination } from "./study-collection-destination.tsx";

const queries = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock("@/features/flashcards/api/flashcard-collection-queries.ts", () => ({
  useFlashcardCollections: queries.list,
}));
vi.mock("@/features/flashcards/api/flashcard-queries.ts", () => ({
  useFlashcardCollection: queries.detail,
}));
vi.mock("@/features/quizzes/api/quiz-collection-queries.ts", () => ({
  useQuizCollections: queries.list,
  useQuizCollection: queries.detail,
}));
vi.mock("./study-collection-picker.tsx", () => ({
  StudyCollectionPicker: ({
    labelAction,
    selectedTitle,
    onQueryChange,
  }: {
    labelAction?: ReactNode;
    selectedTitle?: string;
    onQueryChange: (query: string) => void;
  }) => (
    <>
      <button onClick={() => onQueryChange("outra")}>{selectedTitle ?? "Selecionar"}</button>
      {labelAction}
    </>
  ),
}));
vi.mock("./inline-collection-create.tsx", () => ({
  InlineCollectionCreate: ({
    onCreated,
    onCancel,
  }: {
    onCreated: (item: { id: string; title: string }) => void;
    onCancel: () => void;
  }) => (
    <>
      <button onClick={() => onCreated({ id: "new", title: "Nova" })}>Concluir</button>
      <button onClick={onCancel}>Cancelar</button>
    </>
  ),
}));

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  queries.list.mockImplementation(({ query }: { query: string }) => ({
    data: { items: query ? [] : [{ id: "old", title: "Coleção original" }] },
    isPending: false,
    isError: false,
  }));
  queries.detail.mockImplementation((id: string) => ({
    data: id === "old" ? { title: "Coleção original" } : undefined,
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each(["flashcard", "quizQuestion"] as const)(
  "retains the selected title during search and selects an inline creation: %s",
  async (kind) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Fixture() {
      const [value, setValue] = useState("old");
      return <StudyCollectionDestination kind={kind} value={value} onChange={setValue} />;
    }
    try {
      await act(async () => root.render(<Fixture />));
      await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
      expect(host.textContent).toContain("Coleção original");
      const button = (label: string) =>
        Array.from(host.querySelectorAll("button")).find((item) => item.textContent === label)!;
      await act(async () => button(" Nova coleção").click());
      expect(host.textContent).toContain("Concluir");
      await act(async () => button("Concluir").click());
      expect(host.textContent).toContain("Nova");
      expect(host.textContent).not.toContain("Coleção original");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);

it("does not silently select a destination unless explicitly requested", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const change = vi.fn();
  try {
    await act(async () =>
      root.render(<StudyCollectionDestination kind="flashcard" value="" onChange={change} />),
    );
    expect(change).not.toHaveBeenCalled();
    await act(async () =>
      root.render(
        <StudyCollectionDestination kind="flashcard" value="" autoSelect onChange={change} />,
      ),
    );
    expect(change).toHaveBeenCalledWith("old");
  } finally {
    await act(async () => root.unmount());
  }
});
