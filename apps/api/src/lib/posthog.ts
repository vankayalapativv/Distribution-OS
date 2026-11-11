import type { Context } from "hono";
import type { ApiEnv } from "../types";

/**
 * Send one server exception to PostHog Error Tracking (exceptions only — we
 * capture nothing else). A direct POST to the capture endpoint rather than the
 * posthog-node SDK: the SDK batches and flushes on timers that don't reliably
 * complete inside a Worker's short-lived `waitUntil`, so events were silently
 * lost. A single `fetch` is Workers-native and awaited by the caller's
 * `waitUntil`, so the event actually leaves before the isolate is torn down.
 *
 * Best-effort and fully isolated: the caller runs it in `waitUntil` and this
 * swallows its own errors, so it can never change or break the response. A
 * missing token is a no-op in production; in dev it logs loudly so a
 * misconfiguration isn't silent.
 */
export function capturePostHogException(
  err: Error,
  c: Context<ApiEnv>,
  extra: {
    statusCode: number;
    apiCode: string | null;
    requestId?: string;
    userId?: string | null;
    role?: string | null;
    enterpriseId?: string | null;
  },
): Promise<void> {
  const token = c.env.POSTHOG_PROJECT_TOKEN;
  if (!token) {
    if ((c.env.ENVIRONMENT ?? "production") !== "production") {
      console.error(
        "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return Promise.resolve();
  }

  const host = (c.env.POSTHOG_HOST ?? "https://eu.i.posthog.com").replace(/\/$/, "");
  const body = {
    api_key: token,
    event: "$exception",
    // Attribute to the acting user when known, so the issue carries who hit it.
    distinct_id: extra.userId ?? "api:anonymous",
    properties: {
      $exception_list: [
        {
          type: err.name || "Error",
          value: err.message || "(no message)",
          mechanism: { handled: false, synthetic: false },
        },
      ],
      $exception_type: err.name || "Error",
      $exception_message: err.message || "(no message)",
      // Full stack kept as a property (server stacks aren't source-mapped here).
      stack: err.stack ?? null,
      path: c.req.path,
      method: c.req.method,
      status_code: extra.statusCode,
      api_code: extra.apiCode,
      request_id: extra.requestId,
      role: extra.role,
      // Per-enterprise attribution: a flat property for filtering, plus PostHog
      // group analytics so exceptions roll up per tenant. NULL for platform/unauth.
      enterprise_id: extra.enterpriseId ?? null,
      environment: c.env.ENVIRONMENT ?? "production",
      ...(extra.enterpriseId ? { $groups: { enterprise: extra.enterpriseId } } : {}),
    },
  };

  return fetch(`${host}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(
    () => undefined,
    () => undefined,
  );
}
