// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "./dialog.tsx";

afterEach(() => vi.unstubAllGlobals());

it.each([false, true])(
  "returns focus from a controlled dialog and honors custom restoration (%s)",
  async (custom) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const Fixture = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button id="open-example" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <button id="custom-return">Destino específico</button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
              animated={!custom}
              onCloseAutoFocus={
                custom
                  ? (event) => {
                      event.preventDefault();
                      document.getElementById("custom-return")?.focus();
                    }
                  : undefined
              }
            >
              <DialogTitle>Exemplo</DialogTitle>
              <DialogDescription>Sem persistência</DialogDescription>
              <DialogClose id="close-example">Fechar exemplo</DialogClose>
            </DialogContent>
          </Dialog>
        </>
      );
    };
    try {
      await act(async () => root.render(<Fixture />));
      const opener = host.querySelector<HTMLButtonElement>("#open-example")!;
      await act(async () => {
        opener.focus();
        opener.click();
      });
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      expect(
        document.querySelector('[role="dialog"]')?.className.includes("data-open:animate-in"),
      ).toBe(!custom);
      if (custom) {
        expect(document.querySelector('[data-slot="dialog-overlay"]')?.className).toContain(
          "data-open:animate-none",
        );
      }
      await act(async () => document.getElementById("close-example")!.click());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(document.activeElement?.id).toBe(custom ? "custom-return" : "open-example");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);
