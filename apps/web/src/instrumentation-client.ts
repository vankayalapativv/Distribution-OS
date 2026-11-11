// PostHog — error monitoring ONLY. No product analytics: autocapture, pageviews,
// pageleaves and session replay are all off. Exceptions are reported explicitly
// through `reportWebError` (lib/report-error.ts), the single funnel every window
// error, unhandled rejection and React error boundary already passes through, so
// autocapture of exceptions is left off here too — no double-capture.
//
// Next.js 15.3+ runs this file on the client at startup. A missing token is a
// no-op in production; in dev it logs loudly so the misconfiguration isn't silent.
import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false, // reportWebError captures exceptions explicitly
    disable_session_recording: true,
    person_profiles: "identified_only",
  });
} else if (process.env.NODE_ENV !== "production") {
  console.error(
    "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}
