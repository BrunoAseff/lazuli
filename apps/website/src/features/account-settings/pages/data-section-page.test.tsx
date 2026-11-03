// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import DataSectionPage from "./data-section-page.tsx";

const fixtures = vi.hoisted(() => ({
  analytics: {
    isPending: false,
    isError: false,
    isFetching: false,
    data: undefined,
    refetch: vi.fn(),
  },
}));
vi.mock("@/features/auth/auth-client.ts", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "owner" } }, isPending: false, error: null }),
  },
}));
vi.mock("@/features/analytics/analytics-client.ts", () => ({ resetAnalytics: vi.fn() }));
vi.mock("@/features/analytics/api/analytics-queries.ts", () => ({
  useAnalyticsPreference: () => fixtures.analytics,
  useUpdateAnalyticsPreference: () => ({ isPending: false, isError: false }),
}));
vi.mock("../api/account-settings-queries.ts", () => ({
  useAccountProfile: () => ({
    data: { email: "owner@example.com", methods: [] },
    isPending: false,
    isError: false,
  }),
  useRequestAccountExport: () => ({ isPending: false, isError: false }),
  useDeleteAccount: () => ({ isPending: false, isError: false }),
}));

it.each(["pending", "error"])(
  "keeps export and deletion available when analytics is %s",
  async (state) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    fixtures.analytics.isPending = state === "pending";
    fixtures.analytics.isError = state === "error";
    const client = new QueryClient();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <DataSectionPage />
            </MemoryRouter>
          </QueryClientProvider>,
        ),
      );
      for (const label of ["Solicitar cópia", "Excluir conta"]) {
        const button = Array.from(host.querySelectorAll("button")).find(
          (el) => el.textContent === label,
        );
        expect(button).toBeDefined();
        expect(button!.disabled).toBe(false);
      }
      if (state === "error") {
        expect(host.textContent).toContain("Não foi possível carregar esta preferência.");
        expect(host.querySelector<HTMLButtonElement>('[role="switch"]')!.disabled).toBe(true);
        expect(host.textContent).toContain("Tentar novamente");
      } else
        expect(
          host.querySelector('[aria-label="Carregando preferência de métricas"]'),
        ).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
      client.clear();
      vi.unstubAllGlobals();
    }
  },
);
