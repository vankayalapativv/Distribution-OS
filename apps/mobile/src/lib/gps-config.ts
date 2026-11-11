/**
 * Shared constants, types and small pure helpers for GPS day tracking.
 * (Start Day → the SE ends their own day with the "End day" button; a forgotten
 * day is capped at the next IST midnight. Tracking runs to the end of the IST
 * day, no fixed-hour cutoff. Logistics runs share this, no cap.)
 *
 * Kept import-free (pure constants/types/helpers) so it parses in the node test
 * runner and any restricted JS context — the crypto-backed id generator lives in
 * gps-session (which already pulls in expo modules).
 */
export const GPS_TASK = "distribution-os-day-gps";
export const PING_INTERVAL_MS = 3 * 60 * 1000;
// Near-duplicate collapse floor — NOT a cadence gate. Well below the 3-min
// cadence so a slightly-early scheduled fix isn't dropped (which would double the
// gap); 90 s still collapses same-instant fused-provider bursts.
export const MIN_PING_GAP_MS = 90_000;
// Trust a fix's own time only when recent; else stamp with capture time, so a
// cached/stale fused fix isn't mis-dated (wrong day / out of order on the map).
export const MAX_FIX_AGE_MS = 150_000;
export const FUTURE_SKEW_MS = 60_000; // guard a fix timestamped in the future
export const DAY_ON_KEY = "distribution_os_day_tracking_on";
// Date-stamped "the SE ended their day" flag — blocks re-start for the rest of
// the IST day (the day closes itself via this; there's no fixed-hour auto-stop).
export const DAY_ENDED_KEY = "distribution_os_day_ended";
export const DAY_START_ODO_KEY = "distribution_os_day_start_odometer";
export const CLIENT_SESSION_KEY = "distribution_os_tracking_client_session_id";
export const SERVER_SESSION_KEY = "distribution_os_tracking_server_session_id";
export const CLOSURE_RECOVERY_INTERVAL_MS = 3 * 60 * 1000;
// Native GPS calls / one-shot fixes can hang (wedged foreground service, GPS lock
// that won't settle). Bound them so End / photo capture never block forever.
export const NATIVE_TEARDOWN_TIMEOUT_MS = 4000;
export const CHECK_IN_FIX_TIMEOUT_MS = 5000;

export type StartDayResult =
  | { ok: true; mode: "background" | "foreground" }
  | { ok: false; reason: "permission_denied" | "day_ended" };

export type LocationStatus = "ready" | "foreground_only" | "off";

/** Resolve `p`, but give up after `ms` and yield `fallback` — for native promises
 *  that can hang with no timeout of their own. Also swallows rejections. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Timestamp to store for a fix: its own time when recent + sane, else capture time. */
export function guardedRecordMs(fixMs: number, now: number): number {
  if (fixMs >= now - MAX_FIX_AGE_MS && fixMs <= now + FUTURE_SKEW_MS) return fixMs;
  return now;
}

/** The legacy device-global keys (pre user-scoping). Deleted on stop/logout so
 *  upgraded installs don't leave stale cross-user flags lying around. Pure (no
 *  auth) so it lives here rather than in gps-keys — keeping auth-actions off the
 *  gps-keys → auth import cycle. */
export const LEGACY_UNSCOPED_KEYS = [
  DAY_ON_KEY,
  DAY_START_ODO_KEY,
  CLIENT_SESSION_KEY,
  SERVER_SESSION_KEY,
] as const;

/** The per-user scoped bases, for scrubbing an EXPLICIT user's tracking state
 *  (used when a DIFFERENT user signs in on a shared device — the store user is
 *  not yet that prior user, so the live `scoped()` getter can't reach their keys). */
const SCOPED_BASES = [
  DAY_ON_KEY,
  DAY_ENDED_KEY,
  DAY_START_ODO_KEY,
  CLIENT_SESSION_KEY,
  SERVER_SESSION_KEY,
] as const;

/** Every scoped tracking key belonging to a given userId. */
export function scopedKeysFor(userId: string): string[] {
  return SCOPED_BASES.map((base) => `${base}.${userId}`);
}
