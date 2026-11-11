import { neon } from "@neondatabase/serverless";
import type { Context } from "hono";
import { captureError } from "../services/errors";
import type { ApiEnv } from "../types";

/**
 * Schedule post-response async work (audit logs, notifications, cache warms).
 *
 * In the Cloudflare Workers runtime this delegates to `c.executionCtx.waitUntil`,
 * so behaviour in production is unchanged. Outside that runtime — notably Hono's
 * `app.request()` in unit tests, which provides no `ExecutionContext` — accessing
 * `c.executionCtx` throws "This context has no ExecutionContext". Here we fall back
 * to letting the promise run detached, so a route that fires background work stays
 * testable without every test simulating Workers internals.
 *
 * A rejection in that background work used to be swallowed silently — a failed
 * notification / web-push / admin-notify just vanished. Now every rejection is
 * routed into the in-house error monitor (best-effort, same path as the request
 * error handler) so background failures are visible instead of invisible.
 */
export function waitUntilSafe(c: Context<ApiEnv>, promise: Promise<unknown>): void {
  const reported = Promise.resolve(promise).catch((err) => {
    reportBackgroundFailure(c, err);
  });
  try {
    c.executionCtx.waitUntil(reported);
  } catch {
    // Non-Workers (tests): let it run detached; rejection already handled above.
    void reported;
  }
}

/** Best-effort: record a background-work rejection into the error monitor. Never throws. */
function reportBackgroundFailure(c: Context<ApiEnv>, err: unknown): void {
  try {
    console.error("[background] unhandled failure:", err);
    const databaseUrl = c.env.DATABASE_URL;
    if (!databaseUrl) return;
    const e = err instanceof Error ? err : new Error(String(err));
    void captureError(neon(databaseUrl), {
      source: "api",
      message: e.message || "(no message)",
      stack: e.stack ?? null,
      kind: e.name,
      level: "error",
      route: c.req.path,
      method: c.req.method,
      // Background work runs after the response — there is no HTTP status.
      statusCode: null,
      requestId: c.var.requestId,
      userId: c.var.auth?.userId ?? null,
      role: c.var.auth?.role ?? null,
      environment: c.env.ENVIRONMENT ?? "production",
    }).catch(() => undefined);
  } catch {
    // Monitoring must never destabilise background handling.
  }
}
