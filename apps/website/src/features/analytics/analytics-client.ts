import {
  analyticsEventSchemas,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "@lazuli/shared";
import type { CaptureResult, PostHog } from "posthog-js/dist/module.no-external";

export const analyticsConfigured =
  import.meta.env.PROD &&
  import.meta.env.VITE_ANALYTICS_ENABLED === "true" &&
  Boolean(import.meta.env.VITE_POSTHOG_KEY);
let clientPromise: Promise<PostHog> | null = null;
let statePromise: Promise<PostHog | null> = Promise.resolve(null);
let enabledUserId: string | null = null;
let consentRevision = 0;

const sanitizeAnalyticsPayload = (payload: CaptureResult) => {
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
      $geoip_disable: true,
      $process_person_profile: false,
    },
  };
};

const getClient = () => {
  if (!clientPromise)
    clientPromise = import("posthog-js/dist/module.no-external").then(({ default: posthog }) => {
      posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        advanced_disable_flags: true,
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
        autocapture: false,
        before_send: sanitizeAnalyticsPayload,
        capture_exceptions: false,
        capture_pageview: false,
        capture_pageleave: false,
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
  consentRevision += 1;
  enabledUserId = userId;
  const revision = consentRevision;
  statePromise = statePromise
    .then(() => getClient())
    .then((posthog) => {
      if (revision !== consentRevision || enabledUserId !== userId) return null;
      posthog.reset();
      posthog.opt_in_capturing({ captureEventName: false });
      posthog.identify(userId);
      return posthog;
    })
    .catch(() => null);
};

export const disableAnalytics = () => {
  enabledUserId = null;
  consentRevision += 1;
  const revision = consentRevision;
  if (clientPromise)
    statePromise = statePromise
      .then(() => clientPromise)
      .then((posthog) => {
        if (!posthog || revision !== consentRevision || enabledUserId) return null;
        posthog.reset();
        posthog.opt_out_capturing();
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
