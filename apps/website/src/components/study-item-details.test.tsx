// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { StudyItemDetails } from "./study-item-editor-controls.tsx";

vi.mock("./ui/sheet.tsx", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? children : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <section data-sheet>{children}</section>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
afterEach(() => vi.unstubAllGlobals());

it("mounts details only once when changing from drawer to inline panel", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let resize!: (entries: Array<{ contentRect: { width: number } }>) => void;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: typeof resize) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <StudyItemDetails open description="Material" onOpenChange={() => undefined}>
          <button>Editar fontes</button>
        </StudyItemDetails>,
      ),
    );
    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.querySelector("[data-sheet] button")).not.toBeNull();
    await act(async () => resize([{ contentRect: { width: 224 } }]));
    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.querySelector("aside button")).not.toBeNull();
    expect(host.querySelector("[data-sheet]")).toBeNull();
    await act(async () => resize([{ contentRect: { width: 0 } }]));
    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.querySelector("[data-sheet] button")).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    expect(disconnect).toHaveBeenCalled();
  }
});
