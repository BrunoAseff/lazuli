// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { expect, it, vi } from "vitest";
import LegalPage from "./legal-page.tsx";

it("resets scrolling between two unknown document versions without a hash", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const Fixture = () => {
    const navigate = useNavigate();
    return (
      <>
        <button onClick={() => navigate("/termos/unknown-b")}>Outra versão</button>
        <Routes>
          <Route path="/termos/:version" element={<LegalPage />} />
        </Routes>
      </>
    );
  };
  try {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/termos/unknown-a"]}>
          <Fixture />
        </MemoryRouter>,
      ),
    );
    expect(scroll).toHaveBeenCalledTimes(1);
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroll).toHaveBeenLastCalledWith(0, 0);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
