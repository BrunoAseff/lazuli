// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.tsx";

afterEach(() => vi.unstubAllGlobals());

it("keeps the indicator local to its list when the dialog moves or resizes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let resize: () => void = () => {};
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
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <Tabs defaultValue="gallery">
          <TabsList variant="line">
            <TabsTrigger value="gallery">Galeria</TabsTrigger>
            <TabsTrigger value="upload">Enviar imagem</TabsTrigger>
          </TabsList>
          <TabsContent value="gallery">Galeria</TabsContent>
          <TabsContent value="upload">Upload</TabsContent>
        </Tabs>,
      ),
    );
    const triggers = host.querySelectorAll<HTMLElement>('[role="tab"]');
    Object.defineProperties(triggers[0], { offsetLeft: { value: 0 }, offsetWidth: { value: 60 } });
    Object.defineProperties(triggers[1], {
      offsetLeft: { value: 76 },
      offsetWidth: { value: 110 },
    });
    await act(async () => resize());
    await act(async () =>
      triggers[0]!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(triggers[1]!.getAttribute("aria-selected")).toBe("true");
      const indicator = host.querySelector<HTMLElement>("[data-tab-indicator]")!;
      expect(indicator.style.width).toBe("110px");
      expect(indicator.style.transform).toContain("76px");
      expect(indicator.style.transform).not.toContain("translateY");
    });
    await act(async () => resize());
    expect(host.querySelectorAll("[data-tab-indicator]")).toHaveLength(1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
