// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CreationWorkspace } from "./creation-workspace.tsx";
import { MaterialKindPicker } from "./material-kind-picker.tsx";
import { AiProposalReviewList, type AiReviewFlashcard } from "./ai-proposal-review-list.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("CSS", { escape: (value: string) => value });
});
afterEach(() => vi.unstubAllGlobals());

async function mount(content: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(content));
  return {
    host,
    render: async (next: ReactNode) => {
      await act(async () => root.render(next));
    },
    dispose: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

it("uses a labeled radio choice with a visible selected indicator for material kind", async () => {
  const change = vi.fn();
  const fixture = await mount(<MaterialKindPicker value="flashcard" onChange={change} />);
  try {
    const radios = fixture.host.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect(radios).toHaveLength(2);
    expect(radios[0]?.getAttribute("aria-checked")).toBe("true");
    expect(radios[0]?.querySelector('[data-state="checked"]')).not.toBeNull();
    await act(async () => radios[1]!.click());
    expect(change).toHaveBeenCalledWith("quizQuestion");
  } finally {
    await fixture.dispose();
  }
});

it("keeps the same source mounted when preparation advances to review", async () => {
  const view = (reviewing: boolean) => (
    <CreationWorkspace source={<p>Fonte real</p>} reviewing={reviewing}>
      <p>{reviewing ? "Propostas" : "Configuração"}</p>
    </CreationWorkspace>
  );
  const fixture = await mount(view(false));
  try {
    const origin = fixture.host.querySelector("aside");
    await fixture.render(view(true));
    expect(fixture.host.querySelector("aside")).toBe(origin);
    // In review the dialog title names the stage; the column is labelled instead of repeating it.
    expect(fixture.host.querySelector('[aria-label="Revisar materiais"]')).not.toBeNull();
    expect(fixture.host.textContent).toContain("Propostas");
  } finally {
    await fixture.dispose();
  }
});

it("collapses reading-only sources on mobile but keeps required source controls open", async () => {
  vi.stubGlobal("innerWidth", 390);
  const fixture = await mount(
    <CreationWorkspace source={<p>Fonte real</p>}>
      <p>Preparar</p>
    </CreationWorkspace>,
  );
  try {
    const toggle = fixture.host.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(fixture.host.textContent).toContain("Fonte real");
    expect(
      fixture.host.querySelector(".creation-origin-body")?.getAttribute("data-immediate"),
    ).toBe("true");
  } finally {
    await fixture.dispose();
  }
  const controls = await mount(
    <CreationWorkspace sourceControls source={<button>Escolher documento</button>}>
      <p>Preparar</p>
    </CreationWorkspace>,
  );
  try {
    expect(
      controls.host.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded"),
    ).toBe("true");
    expect(controls.host.textContent).toContain("Escolher documento");
  } finally {
    await controls.dispose();
  }
});

it("preserves custom radio card content such as the theme previews", async () => {
  const fixture = await mount(
    <RadioGroup value="system">
      <RadioGroupItem value="system">
        <span>Sistema</span>
      </RadioGroupItem>
    </RadioGroup>,
  );
  try {
    expect(fixture.host.querySelector('[role="radio"]')?.textContent).toBe("Sistema");
  } finally {
    await fixture.dispose();
  }
});

it("keeps selection and changes when moving between proposals without rendering a long stack", async () => {
  const initial: AiReviewFlashcard[] = [1, 2].map((index) => ({
    id: String(index),
    question: `Pergunta ${index}`,
    answer: `Resposta ${index}`,
    evidence: "Fonte",
    references: [],
    warning: null,
    referenceWarning: null,
    selected: true,
  }));
  function Fixture() {
    const [items, setItems] = useState(initial);
    return (
      <MemoryRouter>
        <TooltipProvider>
          <AiProposalReviewList
            flashcards={items}
            quizQuestions={[]}
            operationId="example"
            source={{
              documentId: "doc",
              documentTitle: "Fonte",
              projectId: "project",
              projectTitle: "Projeto",
            }}
            returnTo="/dashboard"
            onRemove={() => undefined}
            onQuizChange={() => undefined}
            onFlashcardChange={(id, change) =>
              setItems((current) =>
                current.map((item) => (item.id === id ? { ...item, ...change } : item)),
              )
            }
          />
        </TooltipProvider>
      </MemoryRouter>
    );
  }
  const fixture = await mount(<Fixture />);
  try {
    expect(fixture.host.querySelectorAll("article")).toHaveLength(1);
    const question = fixture.host.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        question,
        "Pergunta revisada",
      );
      question.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      fixture.host.querySelector<HTMLButtonElement>('[role="switch"]')!.click(),
    );
    // The proposal index lists every proposal; an excluded one stays listed and says why.
    const rows = () =>
      Array.from(
        fixture.host.querySelectorAll<HTMLElement>('nav[aria-label="Propostas geradas"] li'),
      );
    await act(async () => rows()[1]!.querySelector("button")!.click());
    expect(fixture.host.querySelector("textarea")?.value).toBe("Pergunta 2");
    expect(rows()[0]!.hasAttribute("data-muted")).toBe(true);
    expect(rows()[0]!.textContent).toContain("Fora da coleção");
    expect(fixture.host.querySelector(".proposal-index-head")?.textContent).toContain(
      "1 será salvo",
    );
    await act(async () => rows()[0]!.querySelector("button")!.click());
    expect(fixture.host.querySelector("textarea")?.value).toBe("Pergunta revisada");
    expect(fixture.host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe(
      "false",
    );
  } finally {
    await fixture.dispose();
  }
});

it("exposes actual progress including custom maximum without an unbounded transition", async () => {
  const fixture = await mount(<Progress value={8} max={20} />);
  try {
    expect(fixture.host.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe(
      "8",
    );
    expect(
      fixture.host.querySelector('[data-slot="progress-indicator"]')?.getAttribute("style"),
    ).toContain("translateX(-60%)");
    expect(fixture.host.innerHTML).not.toContain("transition-all");
  } finally {
    await fixture.dispose();
  }
});
