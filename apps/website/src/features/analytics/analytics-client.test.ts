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
vi.mock("posthog-js/dist/web-vitals", () => ({}));

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
  it("exposes when production analytics is disabled", async () => {
    vi.stubEnv("VITE_ANALYTICS_ENABLED", "false");
    const { analyticsConfigured } = await import("./analytics-client.ts");
    expect(analyticsConfigured).toBe(false);
  });

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
        capture_pageleave: true,
        capture_performance: { web_vitals_attribution: false },
        capture_pageview: "history_change",
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

    const pageview = config.before_send({
      event: "$pageview",
      properties: {
        $current_url:
          "https://lazuli.example.com/documents/private-project/document/private-document?token=private#selection",
        $pathname: "/documents/private-project/document/private-document",
        $prev_pageview_pathname: "/flashcards/private-collection",
        $referrer: "https://example.com/private-path",
        $referring_domain: "example.com",
        $session_entry_pathname: "/quizzes/private-quiz",
        $session_entry_url: "https://lazuli.example.com/quizzes/private-quiz?source=private",
        $session_id: "session-1",
        distinct_id: "user-1",
        title: "Material privado",
        token: "phc_test",
      },
      uuid: "event-3",
    });
    expect(pageview?.properties).toEqual({
      $current_url: "https://lazuli.example.com/documents/:projectId/document/:documentId",
      $geoip_disable: true,
      $pathname: "/documents/:projectId/document/:documentId",
      $prev_pageview_pathname: "/flashcards/:collectionId",
      $process_person_profile: false,
      $referring_domain: "example.com",
      $session_entry_pathname: "/quizzes/:collectionId",
      $session_entry_url: "https://lazuli.example.com/quizzes/:collectionId",
      $session_id: "session-1",
      distinct_id: "user-1",
      token: "phc_test",
    });
    expect(JSON.stringify(pageview)).not.toContain("private");

    const webVitals = config.before_send({
      event: "$web_vitals",
      properties: {
        $current_url: "https://lazuli.example.com/documents/private-project?token=private",
        $pathname: "/documents/private-project",
        $session_id: "session-1",
        $web_vitals_LCP_event: { attribution: { element: "Material privado" } },
        $web_vitals_LCP_value: 1234,
        $web_vitals_INP_value: 75,
        distinct_id: "user-1",
        token: "phc_test",
      },
      uuid: "event-4",
    });
    expect(webVitals?.properties).toEqual({
      $current_url: "https://lazuli.example.com/documents/:projectId",
      $geoip_disable: true,
      $pathname: "/documents/:projectId",
      $process_person_profile: false,
      $session_id: "session-1",
      $web_vitals_INP_value: 75,
      $web_vitals_LCP_value: 1234,
      distinct_id: "user-1",
      token: "phc_test",
    });
    expect(JSON.stringify(webVitals)).not.toContain("private");
  });

  it("opts out before resetting identity and does not repeat disabled transitions", async () => {
    const { disableAnalytics, enableAnalytics } = await import("./analytics-client.ts");
    enableAnalytics("user-1");
    await vi.waitFor(() => expect(posthog.identify).toHaveBeenCalledOnce());
    posthog.reset.mockClear();

    disableAnalytics();
    disableAnalytics();

    await vi.waitFor(() => expect(posthog.opt_out_capturing).toHaveBeenCalledOnce());
    expect(posthog.opt_out_capturing.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.reset.mock.invocationCallOrder[0]!,
    );
  });

  it("does not reset consent again when the same user is already enabled", async () => {
    const { enableAnalytics } = await import("./analytics-client.ts");

    enableAnalytics("user-1");
    enableAnalytics("user-1");

    await vi.waitFor(() => expect(posthog.identify).toHaveBeenCalledOnce());
    expect(posthog.reset).toHaveBeenCalledOnce();
    expect(posthog.opt_in_capturing).toHaveBeenCalledOnce();
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
