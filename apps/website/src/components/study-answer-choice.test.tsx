// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { StudyAnswerChoice } from "./study-answer-choice.tsx";

afterEach(() => vi.unstubAllGlobals());

it("keeps the full answer accessible, exposes selection and blocks pending input", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  const onSelect = vi.fn();
  try {
    await act(async () =>
      root.render(
        <StudyAnswerChoice
          text="Resposta completa"
          index={0}
          selected={false}
          onSelect={onSelect}
        />,
      ),
    );
    const button = host.querySelector("button")!;
    expect(button.textContent).toContain("Resposta completa");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    await act(async () => button.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    await act(async () =>
      root.render(
        <StudyAnswerChoice
          text="Resposta completa"
          index={0}
          selected
          disabled
          onSelect={onSelect}
        />,
      ),
    );
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await act(async () => button.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
  }
});
