// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { AccountQueryBoundary } from "./account-query-boundary.tsx";

it("isolates account data before mounting essential routes for a different identity", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.sessionStorage.setItem("lazuli-active-user-id", "previous-user");
  const client = new QueryClient();
  client.setQueryData(["account-settings", "profile"], { email: "previous@example.com" });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const Mounted = () => (
    <div>
      {client.getQueryData(["account-settings", "profile"])
        ? "Previous account"
        : "Isolated account"}
    </div>
  );
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <AccountQueryBoundary userId="current-user">
            <Mounted />
          </AccountQueryBoundary>
        </QueryClientProvider>,
      ),
    );
    expect(host.textContent).toBe("Isolated account");
    expect(window.sessionStorage.getItem("lazuli-active-user-id")).toBe("current-user");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    client.clear();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  }
});
