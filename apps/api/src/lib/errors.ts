import { neon } from "@neondatabase/serverless";
import type { ErrorHandler, NotFoundHandler } from "hono";
import { failure } from "./api-response";
import { captureError } from "../services/errors";
import { capturePostHogException } from "./posthog";
import type { ApiEnv } from "../types";

// ApiError lives in its own dependency-free module (lib/db imports it directly)
// to break the lib → services → lib cycle; re-exported here so existing importers
// are unchanged. See lib/api-error.ts (audit G-0101).
export { ApiError } from "./api-error";
import { ApiError } from "./api-error";

export const notFoundHandler: NotFoundHandler<ApiEnv> = (c) => {
  return c.json(
    failure(c, "NOT_FOUND", `No route found for ${c.req.method} ${c.req.path}`),
    404,
  );
};

/**
 * Record a server-side failure into the in-house error monitor — best-effort and
 * fully isolated: it runs in `waitUntil`, swallows its own errors, and can never
 * change or break the response the user gets. Only real server faults are logged
 * (unexpected throws, or an ApiError raised at 500/503), never 4xx client errors.
 */
function monitorServerError(err: unknown, c: Parameters<ErrorHandler<ApiEnv>>[1]): void {
  try {
    if (!c.executionCtx?.waitUntil) return;
    const e = err instanceof Error ? err : new Error(String(err));
    const apiCode = err instanceof ApiError ? err.code : null;
    const statusCode = err instanceof ApiError ? err.status : 500;
    // Mirror the failure to PostHog Error Tracking (exceptions only), alongside
    // the in-house monitor. Best-effort; its own errors are swallowed inside, and
    // it runs even when the DB (in-house monitor) is unavailable.
    c.executionCtx.waitUntil(
      capturePostHogException(e, c, {
        statusCode,
        apiCode,
        requestId: c.var.requestId,
        userId: c.var.auth?.userId ?? null,
        role: c.var.auth?.role ?? null,
        enterpriseId: c.var.auth?.enterpriseId ?? null,
      }),
    );
    const databaseUrl = c.env.DATABASE_URL;
    if (!databaseUrl) return;
    c.executionCtx.waitUntil(
      captureError(neon(databaseUrl), {
        source: "api",
        message: e.message || "(no message)",
        stack: e.stack ?? null,
        kind: apiCode ?? e.name,
        level: "error",
        route: c.req.path,
        method: c.req.method,
        statusCode,
        requestId: c.var.requestId,
        userId: c.var.auth?.userId ?? null,
        role: c.var.auth?.role ?? null,
        enterpriseId: c.var.auth?.enterpriseId ?? null,
        environment: c.env.ENVIRONMENT ?? "production",
      }).catch(() => undefined),
    );
  } catch {
    // Monitoring must never destabilise error handling.
  }
}

export const errorHandler: ErrorHandler<ApiEnv> = (err, c) => {
  if (err instanceof ApiError) {
    // 5xx ApiErrors are genuine server faults worth monitoring; 4xx are client
    // errors (validation, auth, not-found) and are intentionally not logged.
    if (err.status >= 500) monitorServerError(err, c);
    return c.json(failure(c, err.code, err.message, err.details), err.status);
  }

  console.error(err);
  monitorServerError(err, c);

  return c.json(
    failure(c, "INTERNAL_SERVER_ERROR", "An unexpected error occurred."),
    500,
  );
};
