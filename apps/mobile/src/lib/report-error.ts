/**
 * Reports a mobile JS error to the in-house error monitor (POST /errors/ingest,
 * visible on the web dashboard for SUPER_ADMIN). Fire-and-forget and bullet-proof:
 * never throws, never blocks, and no-ops when signed out.
 *
 * Offline durability: a report that can't be sent (offline, or the POST fails) is
 * parked in a small SQLite ring-buffer (error-buffer.ts) and flushed when
 * connectivity returns (flushPendingErrors in report-error-send.ts) — so a crash
 * in the field still reaches the monitor on the next reconnect. A short in-memory
 * de-dup stops a crash loop from flooding the monitor.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useAuth } from "./auth";
import { getIsOnline } from "./connectivity";
import { getLocalDb } from "./db";
import { enqueueError } from "./error-buffer";
import { capturePostHogException } from "./posthog";
import { post } from "./report-error-send";

export { flushPendingErrors } from "./report-error-send";

type ErrorLevel = "error" | "fatal" | "warning";

export interface ReportContext {
  boundary?: string;
  fatal?: boolean;
  level?: ErrorLevel;
  /** Overrides the derived `kind` (error name) for the monitor's grouping. */
  kind?: string;
  /** Screen/route the error happened on; falls back to the tracked current route. */
  route?: string;
  [k: string]: unknown;
}

export interface IngestPayload {
  source: "mobile";
  message: string;
  stack?: string;
  kind?: string;
  level: ErrorLevel;
  route?: string;
  appVersion?: string;
  context?: unknown;
}

const recent = new Map<string, number>();
const DEDUP_MS = 10_000;

// The current screen, set by the router tracker in the root layout, so every
// report is attributable to where it happened without each call site passing it.
let currentRoute: string | undefined;
export function setErrorRoute(route: string | undefined): void {
  currentRoute = route;
}

export function reportMobileError(error: unknown, context?: ReportContext): void {
  try {
    const token = useAuth.getState().token;
    if (!token) return; // ingest requires auth; nothing to attribute when signed out

    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message || "(no message)";
    const key = `${err.name}|${message}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUP_MS) return;
    recent.set(key, now);
    if (recent.size > 100) recent.clear();

    const payload: IngestPayload = {
      source: "mobile",
      message: message.slice(0, 4000),
      stack: err.stack?.slice(0, 12000),
      kind: context?.kind ?? err.name,
      level: context?.level ?? (context?.fatal ? "fatal" : "error"),
      route: context?.route ?? currentRoute,
      appVersion: Constants.expoConfig?.version ?? undefined,
      context: { ...context, device: { os: Platform.OS, osVersion: String(Platform.Version) } },
    };

    // Mirror to PostHog Error Tracking (exceptions only). It does its own
    // batching/offline handling, so fire it regardless of connectivity.
    capturePostHogException(err, {
      route: payload.route,
      level: payload.level,
      app_version: payload.appVersion,
      ...context,
    });

    // Offline (or a failed send) → buffer for the next reconnect instead of losing it.
    if (!getIsOnline()) {
      enqueueError(getLocalDb(), payload);
      return;
    }
    void post(token, payload).then((ok) => {
      if (!ok) enqueueError(getLocalDb(), payload);
    });
  } catch {
    // Reporting must never throw.
  }
}
