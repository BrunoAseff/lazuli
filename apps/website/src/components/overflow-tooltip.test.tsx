// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { OverflowTooltip } from "./overflow-tooltip.tsx";

vi.mock("@/components/ui/tooltip.tsx", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: ({ children }: { children: ReactNode }) => <div role="tooltip">{children}</div>,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  { name: "a single truncated line", width: 180, height: 20, expected: true },
  { name: "a title clamped to two lines", width: 100, height: 60, expected: true },
  { name: "a fully visible title", width: 100, height: 20, expected: false },
])(
  "offers the full text only when needed for $name, and rechecks after resizing",
  async ({ width, height, expected }) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let resize = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(width);
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(height);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <OverflowTooltip text="Título completo do material">
            {(ref) => <span ref={ref}>Título completo do material</span>}
          </OverflowTooltip>,
        ),
      );
      expect(Boolean(host.querySelector('[role="tooltip"]'))).toBe(expected);
      scrollWidth.mockReturnValue(100);
      scrollHeight.mockReturnValue(40);
      await act(async () => resize());
      expect(host.querySelector('[role="tooltip"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);
