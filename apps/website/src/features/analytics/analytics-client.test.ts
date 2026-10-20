import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  has_opted_in_capturing: vi.fn(() => true),
  identify: vi.fn(),
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js/dist/module.no-external", () => ({ default: posthog }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_ANALYTICS_ENABLED", "true");
  vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
  vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("analytics client", () => {
  it("waits for consent setup before capturing an immediate event", async () => {
    const { captureAnalyticsEvent, enableAnalytics } = await import("./analytics-client.ts");

    enableAnalytics("user-1");
    captureAnalyticsEvent("project_creation_started", {});

    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledOnce());
    expect(posthog.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
    expect(posthog.identify).toHaveBeenCalledWith("user-1");
    expect(posthog.capture).toHaveBeenCalledWith("project_creation_started", {});
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        advanced_disable_flags: true,
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        disable_surveys: true,
        persistence: "memory",
        person_profiles: "never",
      }),
    );

    const config = posthog.init.mock.calls[0]![1] as {
      before_send: (payload: unknown) => null | { event: string; properties: object };
    };
    const sanitized = config.before_send({
      event: "project_created",
      properties: {
        $current_url: "https://app.example.com/projects/private-id",
        distinct_id: "user-1",
        token: "phc_test",
      },
      uuid: "event-1",
    });
    expect(sanitized?.properties).toEqual({
      $geoip_disable: true,
      $process_person_profile: false,
      distinct_id: "user-1",
      token: "phc_test",
    });
    expect(
      config.before_send({
        event: "$identify",
        properties: { distinct_id: "user-1", token: "phc_test" },
        uuid: "event-2",
      }),
    ).toBeNull();
  });

  it("resets identity before persisting the opted-out state", async () => {
    const { disableAnalytics, enableAnalytics } = await import("./analytics-client.ts");
    enableAnalytics("user-1");
    await vi.waitFor(() => expect(posthog.identify).toHaveBeenCalledOnce());
    posthog.reset.mockClear();

    disableAnalytics();

    await vi.waitFor(() => expect(posthog.opt_out_capturing).toHaveBeenCalledOnce());
    expect(posthog.reset.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.opt_out_capturing.mock.invocationCallOrder[0]!,
    );
  });

  it("drops undeclared properties locally", async () => {
    const { captureAnalyticsEvent, enableAnalytics } = await import("./analytics-client.ts");
    enableAnalytics("user-1");
    await vi.waitFor(() => expect(posthog.identify).toHaveBeenCalledOnce());

    captureAnalyticsEvent("project_created", {
      title: "conteúdo privado",
    } as never);

    await Promise.resolve();
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
