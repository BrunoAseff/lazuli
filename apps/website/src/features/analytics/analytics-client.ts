import {
  analyticsEventSchemas,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "@lazuli/shared";
import type { CaptureResult, PostHog } from "posthog-js/dist/module.no-external";

export const analyticsConfigured =
  import.meta.env.PROD &&
  import.meta.env.VITE_ANALYTICS_ENABLED === "true" &&
  Boolean(import.meta.env.VITE_POSTHOG_KEY) &&
  Boolean(import.meta.env.VITE_POSTHOG_HOST);
let clientPromise: Promise<PostHog> | null = null;
let statePromise: Promise<PostHog | null> = Promise.resolve(null);
let enabledUserId: string | null = null;
let consentRevision = 0;

const PUBLIC_ANALYTICS_PATHS = new Set([
  "/",
  "/dashboard",
  "/documents",
  "/flashcards",
  "/forgot-password",
  "/login",
  "/quizzes",
  "/register",
  "/reset-password",
  "/settings/account",
  "/settings/appearance",
  "/settings/data",
  "/settings/security",
  "/settings/study",
  "/settings/usage",
  "/statistics",
  "/verify-email",
]);
const PRIVATE_ANALYTICS_PATHS = [
  [/^\/documents\/[^/]+\/document\/[^/]+$/, "/documents/:projectId/document/:documentId"],
  [/^\/documents\/[^/]+$/, "/documents/:projectId"],
  [/^\/flashcards\/[^/]+$/, "/flashcards/:collectionId"],
  [/^\/quizzes\/[^/]+\/attempts\/[^/]+$/, "/quizzes/:collectionId/attempts/:attemptId"],
  [/^\/quizzes\/[^/]+$/, "/quizzes/:collectionId"],
] as const;
const NAVIGATION_PROPERTY_NAMES = [
  "distinct_id",
  "token",
  "$browser",
  "$browser_version",
  "$device_type",
  "$host",
  "$lib",
  "$lib_version",
  "$os",
  "$os_version",
  "$pageview_id",
  "$prev_pageview_duration",
  "$prev_pageview_id",
  "$referring_domain",
  "$screen_height",
  "$screen_width",
  "$session_entry_referring_domain",
  "$session_id",
  "$viewport_height",
  "$viewport_width",
  "$window_id",
] as const;

const sanitizePathname = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const pathname = value.length > 1 ? value.replace(/\/$/, "") : value;
  if (PUBLIC_ANALYTICS_PATHS.has(pathname)) return pathname;
  return PRIVATE_ANALYTICS_PATHS.find(([pattern]) => pattern.test(pathname))?.[1] ?? "/other";
};

const sanitizeUrl = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return `${url.origin}${sanitizePathname(url.pathname)}`;
  } catch {
    return undefined;
  }
};

const sanitizeNavigationPayload = (payload: CaptureResult) => {
  const properties = Object.fromEntries(
    NAVIGATION_PROPERTY_NAMES.flatMap((key) =>
      key in payload.properties ? [[key, payload.properties[key]]] : [],
    ),
  );
  const currentUrl = sanitizeUrl(payload.properties.$current_url);
  const entryUrl = sanitizeUrl(payload.properties.$session_entry_url);
  const pathname = sanitizePathname(payload.properties.$pathname) ?? "/other";
  const previousPathname = sanitizePathname(payload.properties.$prev_pageview_pathname);
  const entryPathname = sanitizePathname(payload.properties.$session_entry_pathname);
  return {
    ...payload,
    properties: {
      ...properties,
      analyticsIdentity: "account",
      ...(currentUrl ? { $current_url: currentUrl } : {}),
      ...(entryUrl ? { $session_entry_url: entryUrl } : {}),
      ...(entryPathname ? { $session_entry_pathname: entryPathname } : {}),
      ...(previousPathname ? { $prev_pageview_pathname: previousPathname } : {}),
      $geoip_disable: true,
      $pathname: pathname,
      $process_person_profile: false,
    },
  };
};

const sanitizeWebVitalsPayload = (payload: CaptureResult) => {
  const navigationPayload = sanitizeNavigationPayload(payload);
  const metrics = Object.fromEntries(
    Object.entries(payload.properties).filter(
      ([key, value]) =>
        key.startsWith("$web_vitals_") && key.endsWith("_value") && typeof value === "number",
    ),
  );
  return {
    ...navigationPayload,
    properties: {
      ...navigationPayload.properties,
      ...metrics,
    },
  };
};

const sanitizeAnalyticsPayload = (payload: CaptureResult) => {
  // Never send anonymous events or events belonging to a previous account.
  if (!enabledUserId || payload.properties.distinct_id !== enabledUserId) return null;
  if (payload.event === "$pageview" || payload.event === "$pageleave")
    return sanitizeNavigationPayload(payload);
  if (payload.event === "$web_vitals") return sanitizeWebVitalsPayload(payload);
  const event = payload.event as AnalyticsEventName;
  const schema = analyticsEventSchemas[event];
  if (!schema) return null;
  const productProperties = Object.fromEntries(
    Object.entries(payload.properties).filter(
      ([key]) => !key.startsWith("$") && key !== "distinct_id" && key !== "token",
    ),
  );
  const validated = schema.safeParse(productProperties);
  if (!validated.success) return null;
  const technicalProperties = Object.fromEntries(
    ["distinct_id", "token"].flatMap((key) =>
      key in payload.properties ? [[key, payload.properties[key]]] : [],
    ),
  );
  return {
    ...payload,
    properties: {
      ...technicalProperties,
      ...validated.data,
      analyticsIdentity: "account",
      $geoip_disable: true,
      $process_person_profile: false,
    },
  };
};

const getClient = (userId: string) => {
  if (!clientPromise)
    clientPromise = Promise.all([
      import("posthog-js/dist/module.no-external"),
      import("posthog-js/dist/web-vitals"),
    ]).then(([{ default: posthog }]) => {
      posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        advanced_disable_flags: true,
        api_host: import.meta.env.VITE_POSTHOG_HOST,
        ui_host: "https://eu.posthog.com",
        defaults: "2026-05-30",
        // identify() is intentionally disabled by person_profiles: "never".
        // Seed the account ID before the SDK can capture its first pageview.
        bootstrap: { distinctID: userId, isIdentifiedID: true },
        autocapture: false,
        before_send: sanitizeAnalyticsPayload,
        capture_exceptions: false,
        capture_performance: { web_vitals_attribution: false },
        capture_pageview: "history_change",
        capture_pageleave: true,
        disable_session_recording: true,
        disable_surveys: true,
        opt_out_capturing_by_default: true,
        persistence: "memory",
        person_profiles: "never",
      });
      return posthog;
    });
  return clientPromise;
};

export const enableAnalytics = (userId: string) => {
  if (!analyticsConfigured) return;
  if (enabledUserId === userId) return;
  consentRevision += 1;
  enabledUserId = userId;
  const revision = consentRevision;
  statePromise = statePromise
    .then(() =>
      revision === consentRevision && enabledUserId === userId ? getClient(userId) : null,
    )
    .then((posthog) => {
      if (!posthog || revision !== consentRevision || enabledUserId !== userId) return null;
      // Stored SDK consent may already be granted on a fresh page load. Stop
      // capture before resetting; reset otherwise clears active consent and warns.
      posthog.opt_out_capturing();
      posthog.reset({ bootstrap: { distinctID: userId, isIdentifiedID: true } });
      posthog.opt_in_capturing({ captureEventName: false });
      return posthog;
    })
    .catch(() => null);
};

export const disableAnalytics = () => {
  if (!enabledUserId) return;
  enabledUserId = null;
  consentRevision += 1;
  const revision = consentRevision;
  if (clientPromise)
    statePromise = statePromise
      .then(() => clientPromise)
      .then((posthog) => {
        if (!posthog || revision !== consentRevision || enabledUserId) return null;
        posthog.opt_out_capturing();
        posthog.reset({ bootstrap: {} });
        return null;
      })
      .catch(() => null);
  else statePromise = Promise.resolve(null);
};

export const resetAnalytics = () => {
  disableAnalytics();
};

export const captureAnalyticsEvent = <Name extends AnalyticsEventName>(
  event: Name,
  properties: AnalyticsEventProperties[Name],
) => {
  if (!enabledUserId) return;
  const validatedProperties = analyticsEventSchemas[event].safeParse(properties);
  if (!validatedProperties.success) return;
  const revision = consentRevision;
  const userId = enabledUserId;
  void statePromise
    .then((posthog) => {
      if (
        !posthog ||
        revision !== consentRevision ||
        enabledUserId !== userId ||
        !posthog.has_opted_in_capturing()
      )
        return;
      posthog.capture(event, validatedProperties.data);
    })
    .catch(() => undefined);
};
