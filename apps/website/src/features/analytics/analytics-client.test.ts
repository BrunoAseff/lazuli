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
  vi.stubEnv("VITE_POSTHOG_HOST", "https://pha.lazuli.brunoaseff.com.br");
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
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.reset).toHaveBeenCalledWith({
      bootstrap: { distinctID: "user-1", isIdentifiedID: true },
    });
    expect(posthog.capture).toHaveBeenCalledWith("project_creation_started", {});
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        advanced_disable_flags: true,
        api_host: "https://pha.lazuli.brunoaseff.com.br",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-05-30",
        bootstrap: { distinctID: "user-1", isIdentifiedID: true },
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
      analyticsIdentity: "account",
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
      analyticsIdentity: "account",
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
      analyticsIdentity: "account",
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
    await vi.waitFor(() => expect(posthog.opt_in_capturing).toHaveBeenCalledOnce());
    posthog.reset.mockClear();
    posthog.opt_out_capturing.mockClear();

    disableAnalytics();
    disableAnalytics();

    await vi.waitFor(() => expect(posthog.opt_out_capturing).toHaveBeenCalledOnce());
    expect(posthog.opt_out_capturing.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.reset.mock.invocationCallOrder[0]!,
    );
    expect(posthog.reset).toHaveBeenCalledWith({ bootstrap: {} });
  });

  it("does not reset consent again when the same user is already enabled", async () => {
    const { enableAnalytics } = await import("./analytics-client.ts");

    enableAnalytics("user-1");
    enableAnalytics("user-1");

    await vi.waitFor(() => expect(posthog.opt_in_capturing).toHaveBeenCalledOnce());
    expect(posthog.reset).toHaveBeenCalledOnce();
    expect(posthog.opt_in_capturing).toHaveBeenCalledOnce();
  });

  it("drops undeclared properties locally", async () => {
    const { captureAnalyticsEvent, enableAnalytics } = await import("./analytics-client.ts");
    enableAnalytics("user-1");
    await vi.waitFor(() => expect(posthog.opt_in_capturing).toHaveBeenCalledOnce());

    captureAnalyticsEvent("project_created", {
      title: "conteúdo privado",
    } as never);

    await Promise.resolve();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("stops capture before resetting restored consent, then enables capture last", async () => {
    const { enableAnalytics } = await import("./analytics-client.ts");
    enableAnalytics("user-1");
    await vi.waitFor(() => expect(posthog.opt_in_capturing).toHaveBeenCalledOnce());

    expect(posthog.opt_out_capturing.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.reset.mock.invocationCallOrder[0]!,
    );
    expect(posthog.reset.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.opt_in_capturing.mock.invocationCallOrder[0]!,
    );
  });

  it("drops anonymous, previous-account and logged-out automatic events", async () => {
    const { disableAnalytics, enableAnalytics } = await import("./analytics-client.ts");
    enableAnalytics("user-1");
    await vi.waitFor(() => expect(posthog.opt_in_capturing).toHaveBeenCalledOnce());
    const config = posthog.init.mock.calls[0]![1] as {
      before_send: (payload: unknown) => unknown;
    };
    const pageview = (distinctId: string) => ({
      event: "$pageview",
      properties: { distinct_id: distinctId },
    });
    expect(config.before_send(pageview("anonymous-id"))).toBeNull();
    expect(config.before_send(pageview("user-1"))).not.toBeNull();
    enableAnalytics("user-2");
    expect(config.before_send(pageview("user-1"))).toBeNull();
    await vi.waitFor(() => expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(2));
    expect(posthog.reset).toHaveBeenLastCalledWith({
      bootstrap: { distinctID: "user-2", isIdentifiedID: true },
    });
    disableAnalytics();
    expect(config.before_send(pageview("user-2"))).toBeNull();
  });

  it("does not initialize or capture when consent is revoked before SDK loading", async () => {
    const { captureAnalyticsEvent, disableAnalytics, enableAnalytics } =
      await import("./analytics-client.ts");
    enableAnalytics("user-1");
    captureAnalyticsEvent("project_creation_started", {});
    disableAnalytics();
    await vi.waitFor(() => expect(posthog.init).not.toHaveBeenCalled());
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("requires an explicit ingestion host", async () => {
    vi.stubEnv("VITE_POSTHOG_HOST", "");
    const { analyticsConfigured } = await import("./analytics-client.ts");
    expect(analyticsConfigured).toBe(false);
  });
});
