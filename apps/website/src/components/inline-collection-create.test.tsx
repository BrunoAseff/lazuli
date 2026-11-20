// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InlineCollectionCreate } from "./inline-collection-create.tsx";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.tsx";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet.tsx";

const requests = vi.hoisted(() => ({ flashcard: vi.fn(), quiz: vi.fn() }));
vi.mock("@/features/flashcards/api/flashcard-collection-queries.ts", () => ({
  useCreateFlashcardCollection: () => ({ mutateAsync: requests.flashcard, isPending: false }),
}));
vi.mock("@/features/quizzes/api/quiz-collection-queries.ts", () => ({
  useCreateQuizCollection: () => ({ mutateAsync: requests.quiz, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

it.each(["dialog", "sheet"] as const)(
  "Escape cancels only the inline creator inside a %s",
  async (kind) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const close = vi.fn();
    const Root = kind === "dialog" ? Dialog : Sheet;
    const Content = kind === "dialog" ? DialogContent : SheetContent;
    const Title = kind === "dialog" ? DialogTitle : SheetTitle;
    function Fixture() {
      const [creating, setCreating] = useState(true);
      return (
        <Root open onOpenChange={close}>
          <Content aria-describedby={undefined}>
            <Title>Coleções</Title>
            {creating ? (
              <InlineCollectionCreate
                kind="flashcard"
                onCreated={() => {}}
                onCancel={() => setCreating(false)}
              />
            ) : (
              <button>Escolher coleção</button>
            )}
          </Content>
        </Root>
      );
    }
    try {
      await act(async () => root.render(<Fixture />));
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="Nome da nova coleção"]',
      )!;
      await act(async () =>
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        ),
      );
      expect(close).not.toHaveBeenCalled();
      expect(document.querySelector('input[aria-label="Nome da nova coleção"]')).toBeNull();
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      await act(async () =>
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        ),
      );
      expect(close).toHaveBeenCalledWith(false);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);

it.each(["flashcard", "quizQuestion"] as const)(
  "creates the selected kind inline and prevents duplicate submission: %s",
  async (kind) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const created = vi.fn();
    let resolve!: (value: { id: string; title: string }) => void;
    const request = kind === "flashcard" ? requests.flashcard : requests.quiz;
    request.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    try {
      await act(async () =>
        root.render(
          <InlineCollectionCreate kind={kind} onCreated={created} onCancel={() => undefined} />,
        ),
      );
      const input = host.querySelector("input")!;
      const submit = Array.from(host.querySelectorAll("button")).find(
        (button) => button.textContent === "Criar e selecionar",
      )!;
      expect(submit.disabled).toBe(true);
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          input,
          "  Memória  ",
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(submit.disabled).toBe(false);
      await act(async () => {
        submit.click();
        submit.click();
      });
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0]?.[0]).toMatchObject({ title: "Memória", projectId: null });
      await act(async () => resolve({ id: "created", title: "Memória" }));
      expect(created).toHaveBeenCalledWith({ id: "created", title: "Memória" });
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);
