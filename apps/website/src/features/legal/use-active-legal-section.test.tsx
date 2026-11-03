// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useActiveLegalSection } from "./use-active-legal-section.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("follows reading position, including scrolling back and resizing, without requiring an index click", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  const sections = [{ id: "first" }, { id: "second" }, { id: "third" }];
  const positions = [300, 800, 1300];
  const host = document.createElement("div");
  document.body.append(host);
  for (const [index, section] of sections.entries()) {
    const element = document.createElement("section");
    element.id = section.id;
    vi.spyOn(element, "getBoundingClientRect").mockImplementation(
      () => ({ top: positions[index] }) as DOMRect,
    );
    host.append(element);
  }
  const output = document.createElement("div");
  host.append(output);
  const root = createRoot(output);
  const Reader = () => <span>{useActiveLegalSection(sections)}</span>;
  try {
    await act(async () => root.render(<Reader />));
    expect(output.textContent).toBe("first");
    positions.splice(0, 3, -700, 32, 600);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(16);
    });
    expect(output.textContent).toBe("second");
    positions.splice(0, 3, 20, 520, 1020);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(16);
    });
    expect(output.textContent).toBe("first");
    positions.splice(0, 3, -1000, -500, 40);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(16);
    });
    expect(output.textContent).toBe("third");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
