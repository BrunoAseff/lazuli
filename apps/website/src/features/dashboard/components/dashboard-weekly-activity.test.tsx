// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { DashboardWeeklyActivity } from "./dashboard-weekly-activity.tsx";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("weekly activity bar interaction", () => {
  it.each(["mouse", "touch"])(
    "toggles days without Radix closing on %s clicks",
    async (pointerType) => {
      await act(async () => {
        root.render(
          <MemoryRouter>
            <TooltipProvider>
              <DashboardWeeklyActivity
                activity={{
                  days: Array.from({ length: 7 }, (_, day) => ({
                    date: `2026-10-${18 + day}`,
                    flashcardReviews: 1,
                    quizAnswers: 0,
                    total: 1,
                  })),
                  totalItems: 7,
                  flashcardRecallRate: null,
                  quizAccuracyRate: null,
                }}
              />
            </TooltipProvider>
          </MemoryRouter>,
        );
      });
      const bars = host.querySelectorAll<HTMLButtonElement>("button[aria-label]");
      const first = bars[0]!;
      const second = bars[1]!;
      const click = async (bar: HTMLButtonElement) => {
        const down = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
        Object.defineProperty(down, "pointerType", { value: pointerType });
        const event = new MouseEvent("click", { bubbles: true, cancelable: true });
        await act(async () => {
          bar.dispatchEvent(down);
        });
        expect(down.defaultPrevented).toBe(true);
        await act(async () => {
          bar.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
      };

      await click(first);
      expect(first.getAttribute("data-state")).not.toBe("closed");
      await click(first);
      expect(first.getAttribute("data-state")).toBe("closed");
      await click(first);
      await click(second);
      expect(first.getAttribute("data-state")).toBe("closed");
      expect(second.getAttribute("data-state")).not.toBe("closed");
    },
  );
});
