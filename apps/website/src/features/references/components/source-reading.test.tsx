// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { SourceReading } from "./source-reading.tsx";

afterEach(() => vi.unstubAllGlobals());

it("preserves all source text and offers expansion only when the excerpt overflows", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let measure: () => void = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        measure = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    const text = "Início\n\nFim da fonte, que não pode ser descartado.";
    await act(async () => root.render(<SourceReading text={text} />));
    const reading = host.querySelector<HTMLElement>("[data-source-reading]")!;
    expect(reading.textContent).toContain("Fim da fonte");
    expect(host.querySelector("button")).toBeNull();
    Object.defineProperties(reading, {
      scrollHeight: { value: 900 },
      clientHeight: { value: 200 },
    });
    await act(async () => measure());
    const button = host.querySelector<HTMLButtonElement>("button")!;
    expect(button.getAttribute("aria-controls")).toBe(reading.id);
    await act(async () => button.click());
    expect(reading.dataset.expanded).toBe("true");
    expect(reading.tabIndex).toBe(0);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await act(async () => button.click());
    expect(reading.dataset.expanded).toBe("false");
    expect(reading.textContent).toContain("Fim da fonte");
  } finally {
    await act(async () => root.unmount());
  }
});
