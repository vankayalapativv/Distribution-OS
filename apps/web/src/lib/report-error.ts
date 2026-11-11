/**
 * Client-side error reporter for the web dashboard. Fire-and-forget: it POSTs to
 * the same-origin /api/report-error sink (which forwards to the API with the
 * session cookie) and never throws — reporting must never itself break a page.
 *
 * A short in-memory de-dup stops a render-loop or a repeated rejection from
 * flooding the monitor with hundreds of identical events in one session.
 */
import posthog from "posthog-js";

const recent = new Map<string, number>();
const DEDUP_MS = 10_000;

export function reportWebError(
  error: unknown,
  context?: { boundary?: string; digest?: string; [k: string]: unknown },
): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message || "(no message)";
    const key = `${err.name}|${message}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUP_MS) return;
    recent.set(key, now);
    if (recent.size > 100) recent.clear();

    const body = JSON.stringify({
      message: message.slice(0, 4000),
      // Cap the stack: keepalive requests have a ~64KB body budget, and the
      // server stores at most 12KB anyway.
      stack: err.stack?.slice(0, 12000),
      kind: err.name,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      context,
    });

    // keepalive lets the report survive a navigation/unload after the throw.
    void fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);

    // Mirror to PostHog Error Tracking (exceptions only). No-op until posthog is
    // initialised (instrumentation-client.ts); calls made before init are queued.
    try {
      posthog.captureException(err, {
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
        ...context,
      });
    } catch {
      // PostHog must never break reporting.
    }
  } catch {
    // Never let reporting throw.
  }
}

/** Install window-level listeners once, for runtime errors outside React render. */
export function installWebErrorReporting(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __sriAparajitaErrHooked?: boolean };
  if (w.__sriAparajitaErrHooked) return;
  w.__sriAparajitaErrHooked = true;

  window.addEventListener("error", (e) => {
    reportWebError(e.error ?? new Error(e.message), { boundary: "window.onerror" });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    reportWebError(reason instanceof Error ? reason : new Error(String(reason)), {
      boundary: "unhandledrejection",
    });
  });
}
