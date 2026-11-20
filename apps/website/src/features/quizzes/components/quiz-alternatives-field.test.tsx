// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { QuizAlternativesField, type QuizOptionDraft } from "./quiz-alternatives-field.tsx";

vi.mock("@/components/ui/tooltip.tsx", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

afterEach(() => vi.unstubAllGlobals());

it("only removes the requested option after confirmation and leaves cancel unchanged", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const options: QuizOptionDraft[] = [
    { id: "a", text: "Primeira", isCorrect: true },
    { id: "b", text: "Segunda", isCorrect: false },
    { id: "c", text: "Terceira", isCorrect: false },
  ];
  const onChange = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const click = async (element: Element | null) => {
    expect(element).not.toBeNull();
    await act(async () => (element as HTMLElement).click());
  };
  try {
    await act(async () =>
      root.render(<QuizAlternativesField options={options} onChange={onChange} />),
    );
    expect(host.querySelectorAll("textarea")).toHaveLength(3);
    expect(host.textContent).not.toContain("Esta alternativa está repetida.");
    expect(host.querySelector('[aria-label="Ações da alternativa 2"]')).toBeNull();
    await click(host.querySelector('button[aria-label="Remover alternativa 2"]'));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    await click(
      Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(
        (el) => el.textContent === "Cancelar",
      ) ?? null,
    );
    expect(onChange).not.toHaveBeenCalled();
    await click(host.querySelector('button[aria-label="Remover alternativa 2"]'));
    await click(
      Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(
        (el) => el.textContent === "Remover alternativa",
      ) ?? null,
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith([options[0], options[2]]);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    await act(async () =>
      root.render(<QuizAlternativesField options={options.slice(0, 2)} onChange={onChange} />),
    );
    expect(
      host.querySelector<HTMLButtonElement>('button[aria-label="Remover alternativa 1"]')?.disabled,
    ).toBe(true);
    expect(
      host.querySelector<HTMLButtonElement>('button[aria-label="Mover alternativa 1 para cima"]')
        ?.disabled,
    ).toBe(true);
    onChange.mockClear();
    await click(host.querySelector('button[aria-label="Mover alternativa 1 para baixo"]'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith([options[1], options[0]]);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
