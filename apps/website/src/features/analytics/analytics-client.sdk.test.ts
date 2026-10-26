// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult, PostHog } from "posthog-js/dist/module.no-external";

const observed = vi.hoisted(() => ({
  client: null as PostHog | null,
  events: [] as CaptureResult[],
  send: vi.fn(),
  restoredOptIn: false,
}));

// Exercise the installed SDK, not a mock of reset/consent/identity. Intercept
// only its transport boundary: no fixture may reach the production project.
vi.mock("posthog-js/dist/module.no-external", async (importOriginal) => {
  const actual = await importOriginal<typeof import("posthog-js/dist/module.no-external")>();
  const client = new actual.PostHog();
  observed.client = client;
  const init = client.init.bind(client);
  vi.spyOn(client, "init").mockImplementation((token, config, name) => {
    const result = init(
      token,
      {
        ...config,
        before_send: (payload) => {
          const sanitized = config?.before_send;
          const result = typeof sanitized === "function" ? sanitized(payload) : payload;
          if (result) observed.events.push(result);
          return null;
        },
      },
      name,
    );
    observed.restoredOptIn = client.has_opted_in_capturing();
    return result;
  });
  return { ...actual, default: client };
});
vi.mock("posthog-js/dist/web-vitals", () => ({}));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  observed.events = [];
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_ANALYTICS_ENABLED", "true");
  vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_not_a_real_project");
  vi.stubEnv("VITE_POSTHOG_HOST", "https://analytics.invalid");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network forbidden in SDK tests")));
  observed.send.mockClear();
  observed.send.mockImplementation(() => {
    throw new Error("Network forbidden in SDK tests");
  });
  vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(observed.send);
});

afterEach(() => {
  observed.client?.opt_out_capturing();
  observed.client?.reset({ bootstrap: {} });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("production analytics with the real PostHog SDK", () => {
  it("keeps stable account IDs across logout/login and switches, without reset warnings", async () => {
    // This is the production-only condition missing from the previous tests:
    // the SDK restores opt-in persisted by an earlier visit before init returns.
    localStorage.setItem("__ph_opt_in_out_phc_test_not_a_real_project", "1");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { captureAnalyticsEvent, disableAnalytics, enableAnalytics } =
      await import("./analytics-client.ts");
    enableAnalytics("account-1");
    captureAnalyticsEvent("project_creation_started", {});
    await vi.waitFor(() =>
      expect(observed.events.some((e) => e.event === "project_creation_started")).toBe(true),
    );
    const client = observed.client!;
    expect(observed.restoredOptIn).toBe(true);
    expect(client.get_distinct_id()).toBe("account-1");
    expect(client.config.person_profiles).toBe("never");
    expect(client.config.persistence).toBe("memory");
    disableAnalytics();
    const beforeLogout = observed.events.length;
    client.capture("$pageview");
    captureAnalyticsEvent("project_creation_started", {});
    await vi.waitFor(() => expect(client.has_opted_in_capturing()).toBe(false));
    expect(client.get_distinct_id()).not.toBe("account-1");
    expect(observed.events).toHaveLength(beforeLogout);
    enableAnalytics("account-1");
    await vi.waitFor(() => expect(client.has_opted_in_capturing()).toBe(true));
    expect(client.get_distinct_id()).toBe("account-1");
    enableAnalytics("account-2");
    captureAnalyticsEvent("project_creation_started", {});
    await vi.waitFor(() => expect(client.get_distinct_id()).toBe("account-2"));
    await vi.waitFor(() =>
      expect(observed.events.at(-1)?.properties.distinct_id).toBe("account-2"),
    );
    expect(
      observed.events.every((e) => ["account-1", "account-2"].includes(e.properties.distinct_id)),
    ).toBe(true);
    expect(warn.mock.calls.flat().join(" ")).not.toContain("reset() cleared the stored consent");
    expect(fetch).not.toHaveBeenCalled();
    expect(observed.send).not.toHaveBeenCalled();

    // Positive controls: the exact same SDK really does ignore identify() in
    // this privacy mode and emit the reported warning with the old sequence.
    client.identify("account-3");
    expect(client.get_distinct_id()).toBe("account-2");
    client.reset();
    expect(warn.mock.calls.flat().join(" ")).toContain("reset() cleared the stored consent");
    expect(client.has_opted_in_capturing()).toBe(false);
  });
});
