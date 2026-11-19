// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PracticeSetupDialog } from "./practice-setup-dialog.tsx";

const state = vi.hoisted(() => ({
  availability: {
    activeSession: null as null | { id: string; reviewedCards: number; totalCards: number },
    archived: false,
    newCards: 0,
    dueCards: 3,
    totalAvailable: 3,
  },
  mutate: vi.fn(),
  navigate: vi.fn(),
  close: vi.fn(),
}));
vi.mock("react-router", () => ({ useNavigate: () => state.navigate }));
vi.mock("../api/flashcard-queries.ts", () => ({
  usePracticeAvailability: () => ({ data: state.availability, isPending: false, isError: false }),
  useCreatePracticeSession: () => ({ mutateAsync: state.mutate, isPending: false }),
}));
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
  state.availability.activeSession = null;
  state.availability.dueCards = 3;
  state.availability.totalAvailable = 3;
  state.mutate.mockReset().mockResolvedValue({ id: "new-session" });
  state.navigate.mockReset();
  state.close.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const mount = async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(<PracticeSetupDialog open collectionId="collection" onOpenChange={state.close} />),
  );
  return async () => {
    await act(async () => root.unmount());
    host.remove();
  };
};
const button = (text: string) =>
  Array.from(document.querySelectorAll("button")).find((item) => item.textContent === text)!;

it("shows the actual available count and sends the selected session limit", async () => {
  state.availability.dueCards = 30;
  state.availability.totalAvailable = 30;
  const dispose = await mount();
  try {
    expect(document.body.textContent).toContain("Para revisar");
    expect(document.body.textContent).not.toContain("Vencidos");
    expect(button("Estudar 20 flashcards")).toBeDefined();
    await act(async () =>
      button("20").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    expect(button("50").getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("Estudar 30 flashcards").click());
    expect(state.mutate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ size: 50, abandonActive: false }),
    );
    expect(state.navigate).toHaveBeenCalledWith("/flashcards/collection/practice/new-session");
  } finally {
    await dispose();
  }
});

it("hides the session limit when everything available fits in the smallest session", async () => {
  const dispose = await mount();
  try {
    expect(document.body.textContent).not.toContain("Até quantos flashcards?");
    expect(button("Estudar 3 flashcards")).toBeDefined();
  } finally {
    await dispose();
  }
});

it("does not abandon an active session until explicitly confirmed, and restores focus after canceling", async () => {
  state.availability.activeSession = { id: "active-session", reviewedCards: 2, totalCards: 10 };
  const dispose = await mount();
  try {
    expect(button("Continuar prática").dataset.variant).toBe("default");
    await act(async () => {
      button("Iniciar outra").focus();
      button("Iniciar outra").click();
    });
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(state.mutate).not.toHaveBeenCalled();
    await act(async () => button("Cancelar").click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(button("Iniciar outra"));
    expect(state.mutate).not.toHaveBeenCalled();
    await act(async () => button("Iniciar outra").click());
    await act(async () => button("Encerrar e iniciar outra").click());
    expect(state.mutate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ abandonActive: true }),
    );
  } finally {
    await dispose();
  }
});
