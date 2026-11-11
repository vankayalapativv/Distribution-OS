import PostHog from "posthog-react-native";

/**
 * PostHog — error monitoring ONLY. We use a raw client (not PostHogProvider), so
 * nothing is autocaptured: no screen views, touches or app-lifecycle events. The
 * one thing we send is exceptions, routed here from `reportMobileError` (the
 * single funnel every boundary, global error and unhandled rejection passes
 * through). A missing token is a no-op in production; in dev it logs loudly.
 */
const token = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let client: PostHog | null = null;
let warned = false;

function getClient(): PostHog | null {
  if (!token) {
    if (__DEV__ && !warned) {
      warned = true;
      console.error(
        "EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return null;
  }
  if (!client) client = new PostHog(token, { host });
  return client;
}

type CaptureProps = NonNullable<Parameters<PostHog["captureException"]>[1]>;

/** Send one exception to PostHog Error Tracking. Best-effort; never throws. */
export function capturePostHogException(error: Error, properties?: Record<string, unknown>): void {
  try {
    getClient()?.captureException(error, properties as CaptureProps | undefined);
  } catch {
    // PostHog must never break error reporting.
  }
}
