// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ViewSelector } from "./view-selector.tsx";
import { Switch } from "./ui/switch.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.tsx";
import { StudyReveal } from "./study-reveal.tsx";
import { Command } from "./ui/command.tsx";

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

it("keeps command keyboard selection immediate and restores pointer transitions without dropping caller handlers", async () => {
  const onKey = vi.fn();
  const onPointer = vi.fn();
  const { host, dispose } = await mount(
    <Command onKeyDownCapture={onKey} onPointerMoveCapture={onPointer}>
      Pesquisa
    </Command>,
  );
  try {
    const command = host.querySelector<HTMLElement>("[cmdk-root]")!;
    expect(command.dataset.input).toBe("pointer");
    await act(async () =>
      command.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })),
    );
    expect(command.dataset.input).toBe("keyboard");
    expect(onKey).toHaveBeenCalledTimes(1);
    await act(async () => command.dispatchEvent(new Event("pointermove", { bubbles: true })));
    expect(command.dataset.input).toBe("pointer");
    expect(onPointer).toHaveBeenCalledTimes(1);
  } finally {
    await dispose();
  }
});

it("reveals the answer immediately for keyboard input and moves focus to the labeled region", async () => {
  const { host, dispose } = await mount(
    <StudyReveal animated={false} label="Resposta do flashcard">
      Resposta completa
    </StudyReveal>,
  );
  try {
    const region = host.querySelector<HTMLElement>('[role="region"]')!;
    expect(region.textContent).toBe("Resposta completa");
    // Keyboard reveal shows the final state at once: the answer is opaque in place, no entrance offset.
    const answer = region.querySelector<HTMLElement>("div")!;
    expect(answer.style.opacity).toBe("1");
    expect(answer.style.transform).toBe("none");
    expect(document.activeElement).toBe(region);
  } finally {
    await dispose();
  }
});

const mount = async (content: React.ReactNode) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(content));
  return {
    host,
    dispose: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
};

it("selects a view with pointer and arrow keys, retaining one tab stop and moving focus", async () => {
  const Fixture = () => {
    const [value, setValue] = useState("graph");
    return (
      <ViewSelector
        label="Apresentação"
        value={value}
        onChange={setValue}
        options={[
          { value: "graph", label: "Gráfico" },
          { value: "table", label: "Tabela" },
        ]}
      />
    );
  };
  const { host, dispose } = await mount(<Fixture />);
  try {
    const [graph, table] = Array.from(host.querySelectorAll("button"));
    expect(graph!.getAttribute("aria-pressed")).toBe("true");
    await act(async () => table!.click());
    expect(table!.getAttribute("aria-pressed")).toBe("true");
    expect(graph!.tabIndex).toBe(-1);
    await act(async () =>
      table!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })),
    );
    expect(graph!.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(graph);
    expect(host.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    await act(async () =>
      graph!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })),
    );
    expect(table!.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(table);
  } finally {
    await dispose();
  }
});

it("preserves switch labeling, native checked state, disabled behavior and controlled callbacks", async () => {
  const changed = vi.fn();
  const { host, dispose } = await mount(
    <>
      <Switch aria-label="Comparar períodos" onCheckedChange={changed} />
      <Switch aria-label="Indisponível" disabled onCheckedChange={changed} />
    </>,
  );
  try {
    const [control, disabled] = Array.from(host.querySelectorAll('button[role="switch"]'));
    expect(control!.getAttribute("aria-checked")).toBe("false");
    await act(async () => (control as HTMLButtonElement).click());
    expect(control!.getAttribute("aria-checked")).toBe("true");
    expect(changed).toHaveBeenCalledExactlyOnceWith(true);
    await act(async () => (disabled as HTMLButtonElement).click());
    expect(disabled!.getAttribute("aria-checked")).toBe("false");
    expect(changed).toHaveBeenCalledTimes(1);
  } finally {
    await dispose();
  }
});

it("keeps Radix tabs and panels connected after adapting the selection animation", async () => {
  const { host, dispose } = await mount(
    <Tabs defaultValue="cards">
      <TabsList variant="line">
        <TabsTrigger value="cards">Flashcards</TabsTrigger>
        <TabsTrigger value="quiz">Quizzes</TabsTrigger>
      </TabsList>
      <TabsContent value="cards">Revisões</TabsContent>
      <TabsContent value="quiz">Respostas</TabsContent>
    </Tabs>,
  );
  try {
    const tab = host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]!;
    await act(async () =>
      tab.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    expect(tab.getAttribute("aria-selected")).toBe("true");
    const panel = host.querySelector('[role="tabpanel"][data-state="active"]')!;
    expect(panel.textContent).toBe("Respostas");
    expect(panel.id).toBe(tab.getAttribute("aria-controls"));
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
  } finally {
    await dispose();
  }
});
