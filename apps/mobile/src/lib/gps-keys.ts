/**
 * Per-user SecureStore keys for day/tracking state.
 *
 * These field devices are SHARED — one phone, many sales executives logging in
 * and out through the day. A device-GLOBAL "day on" / tracking-session key would
 * leak one user's state to whoever logs in next (their app would think the day
 * is already running, and background pings would attach to the previous user's
 * server session). So every per-user flag is namespaced by userId: `${base}.${id}`.
 *
 * The separator MUST be a character SecureStore allows in a key — it validates
 * keys against /^[\w.-]+$/ and THROWS on anything else. A ':' (the obvious
 * choice, and what this used at first) is rejected, so every scoped write/read
 * threw and was swallowed by its `.catch`, silently breaking all day-tracking
 * persistence. A '.' is valid (so are '-' and '_'); the userId is a UUID
 * (hex + '-'), which is already valid.
 *
 * userId comes from the auth store, which is populated wherever these keys are
 * touched (start-day, stop/logout — logout stops tracking BEFORE it clears the
 * user — the watchdog, and sync, all already read the token the same way). When
 * no user is in the store we fall back to the bare base key, but tracking only
 * runs for a signed-in user, so that branch is effectively a safe no-op.
 */
import { useAuth } from "./auth";
import {
  CLIENT_SESSION_KEY,
  DAY_ENDED_KEY,
  DAY_ON_KEY,
  DAY_START_ODO_KEY,
  SERVER_SESSION_KEY,
} from "./gps-config";

function scoped(base: string): string {
  const userId = useAuth.getState().user?.id;
  return userId ? `${base}.${userId}` : base;
}

/** "Day tracking is on" flag, scoped to the signed-in user. */
export const dayOnKey = (): string => scoped(DAY_ON_KEY);
/** "The SE ended their day" flag, scoped to the signed-in user. */
export const dayEndedKey = (): string => scoped(DAY_ENDED_KEY);
/** The day's starting odometer reading (whole km), scoped to the signed-in user.
 *  Kept so End-day can enforce end > start even when the server can't be reached. */
export const dayStartOdoKey = (): string => scoped(DAY_START_ODO_KEY);
/** Client-generated tracking-session id, scoped to the signed-in user. */
export const clientSessionKey = (): string => scoped(CLIENT_SESSION_KEY);
/** Server tracking-session id, scoped to the signed-in user. */
export const serverSessionKey = (): string => scoped(SERVER_SESSION_KEY);

// The PURE key helpers (LEGACY_UNSCOPED_KEYS, scopedKeysFor) moved to gps-config
// so auth-actions can import them WITHOUT pulling in this module's `useAuth`
// import — which is what created the auth → auth-actions → gps-keys → auth cycle.
