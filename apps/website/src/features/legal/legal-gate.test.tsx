// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@lazuli/shared";
import { LegalGate } from "./legal-gate.tsx";

const api = vi.hoisted(() => ({ fetchLegalStatus: vi.fn(), acceptLegal: vi.fn() }));
vi.mock("./legal-api.ts", () => api);
const pending = {
  accepted: false,
  acceptedAt: null,
  termsVersion: CURRENT_TERMS_VERSION,
  privacyVersion: CURRENT_PRIVACY_VERSION,
};
let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};
const render = async (path = "/dashboard") => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <LegalGate userId="user-1">
            <div>Private study content</div>
          </LegalGate>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await flush();
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  api.fetchLegalStatus.mockResolvedValue(pending);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  client.clear();
  vi.unstubAllGlobals();
});

describe("required contract dialog", () => {
  it("keeps content unmounted, blocks Escape and requires explicit agreement", async () => {
    await render();
    expect(host.textContent).not.toContain("Private study content");
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector("[data-slot=dialog-close]")).toBeNull();
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent === "Concordar e continuar",
    )!;
    expect(confirm.disabled).toBe(true);
    await act(async () => {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(api.acceptLegal).not.toHaveBeenCalled();
    expect(dialog.querySelector('a[href="/account-options"]')).not.toBeNull();
    expect(dialog.querySelector('a[href="/termos"]')?.getAttribute("target")).toBe("_blank");
    const label = dialog.querySelector('label[for="legal-acceptance"]')!;
    expect(label.querySelector('a[href="/termos"]')).not.toBeNull();
    expect(label.querySelector('a[href="/privacidade"]')).not.toBeNull();
    expect(dialog.querySelector("nav")).toBeNull();
  });
  it("retains the selection on error, then opens content only after the server confirms", async () => {
    api.acceptLegal
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ...pending, accepted: true, acceptedAt: "2026-10-29T12:00:00Z" });
    await render();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[role=checkbox]")!.click();
    });
    const confirm = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Concordar e continuar",
    )!;
    await act(async () => confirm.click());
    await flush();
    expect(document.querySelector("[role=alert]")?.textContent).toContain(
      "Não foi possível salvar",
    );
    expect(document.querySelector("[role=checkbox]")?.getAttribute("aria-checked")).toBe("true");
    expect(host.textContent).not.toContain("Private study content");
    await act(async () => confirm.click());
    await flush();
    expect(host.textContent).toContain("Private study content");
    expect(api.acceptLegal).toHaveBeenCalledTimes(2);
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
  it("does not repeat the dialog when the current contract is already accepted", async () => {
    api.fetchLegalStatus.mockResolvedValue({
      ...pending,
      accepted: true,
      acceptedAt: "2026-10-29T12:00:00Z",
    });
    await render();
    expect(host.textContent).toContain("Private study content");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
  it("keeps essential options reachable even when the status request fails", async () => {
    api.fetchLegalStatus.mockRejectedValue(new Error("offline"));
    await render("/account-options");
    expect(host.textContent).toContain("Private study content");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("does not require a new contract acceptance only because the privacy notice changed", async () => {
    api.fetchLegalStatus.mockResolvedValue({
      ...pending,
      accepted: true,
      acceptedAt: "2026-10-29T12:00:00Z",
      privacyVersion: "new-privacy-notice",
    });
    await render();
    expect(host.textContent).toContain("Private study content");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
  it("requires a page refresh instead of accepting an unseen server edition", async () => {
    api.fetchLegalStatus.mockResolvedValue({ ...pending, termsVersion: "new-server-version" });
    await render();
    expect(document.querySelector("[role=alert]")?.textContent).toContain("Atualize a página");
    expect(document.querySelector("[role=checkbox]")).toBeNull();
  });
});
