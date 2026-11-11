/**
 * The two heavyweight auth-store actions — login (with role gate) and logout
 * (full local teardown). Extracted from auth.ts to keep the store module small;
 * they receive the store's `set` and mutate it exactly as the inline versions did.
 */
import * as Notifications from "expo-notifications";
import { apiFetch, ApiRequestError } from "./api";
import {
  type AuthSet,
  type AuthUser,
  LAST_USER_KEY,
  SESSION_KEY,
  storage,
  TOKEN_KEY,
  USER_KEY,
} from "./auth-storage";
import { getLocalDb } from "./db";
import { LEGACY_UNSCOPED_KEYS, scopedKeysFor } from "./gps-config";
import { clearAllLocalData } from "./local-db";
import { neonJwtFromSession, neonSignIn, neonSignOut } from "./neon-auth";
import { queryClient } from "./query-client";

/**
 * Shared-device hygiene: wipe a PREVIOUS user's local footprint when a DIFFERENT
 * user signs in (e.g. SE A's app was killed without logging out, then SE B logs
 * in). Clears their scoped tracking keys, scheduled reminders, local SQLite
 * (GPS buffer, delivery mirror, reminders, caches, tasks) and the in-memory
 * React Query cache — so none of A's data leaks into B's session. A returning
 * user (same id) skips this and keeps their un-flushed GPS buffer + caches.
 */
async function wipePreviousUserData(priorUserId: string): Promise<void> {
  const keys = [...scopedKeysFor(priorUserId), ...LEGACY_UNSCOPED_KEYS];
  await Promise.all(keys.map((k) => storage.del(k).catch(() => undefined)));
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  const db = getLocalDb();
  if (db) {
    try {
      clearAllLocalData(db);
    } catch {
      // Best-effort — never block login on a cache-clear failure.
    }
  }
  queryClient.clear();
}

export async function login(set: AuthSet, identifier: string, password: string): Promise<void> {
  // 1. Authenticate against Neon Managed Better Auth; keep the session (JWTs are
  //    minted from it) and the Neon profile (name/email). `identifier` is the
  //    user's email OR phone number — the API resolves a phone to its account.
  const { session, user: neonUser } = await neonSignIn(identifier, password);
  const token = await neonJwtFromSession(session);
  if (!token) {
    throw new ApiRequestError("AUTH_ERROR", "Could not obtain a session token.", 500);
  }

  // 2. Resolve the app role + user id — Neon tokens carry no role, so the API
  //    maps the Neon user id (sub) → users.app_login_id → role.
  const me = await apiFetch<{
    auth: { role: string | null; userId: string | null; enterpriseId: string | null };
  }>("/me", { token });
  const role = me.auth.role;

  // This app serves field Sales Executives, Logistics, and (2026-08) SUPER_ADMIN
  // — who get their own admin area. MANAGER / ACCOUNTANT remain web-only.
  const allowedRoles = ["SALES_EXECUTIVE", "LOGISTICS", "SUPER_ADMIN"];
  if (!role || !allowedRoles.includes(role)) {
    throw new ApiRequestError(
      "FORBIDDEN",
      "This app is for Sales Executives, Logistics, and Super Admins. Managers/Accountants use the web dashboard.",
      403,
    );
  }

  const user: AuthUser = {
    id: me.auth.userId ?? neonUser.id,
    name: neonUser.name,
    email: neonUser.email,
    role,
    enterpriseId: me.auth.enterpriseId ?? null,
  };

  // Shared-device wipe: if a DIFFERENT user than last time is signing in, clear
  // the previous user's local data BEFORE this user's session is established.
  try {
    const priorUserId = await storage.get(LAST_USER_KEY);
    if (priorUserId && priorUserId !== user.id) {
      await wipePreviousUserData(priorUserId);
    }
    await storage.set(LAST_USER_KEY, user.id);
  } catch {
    // Best-effort — a hygiene failure must never block a valid sign-in.
  }

  await Promise.all([
    storage.set(SESSION_KEY, session),
    storage.set(TOKEN_KEY, token),
    storage.set(USER_KEY, JSON.stringify(user)),
  ]);
  set({ token, user });
  // Re-enable the native tracking guard for this device/session.
  void import("./gps").then((gps) => gps.setNativeSignedIn(true)).catch(() => undefined);
}

export async function logout(set: AuthSet): Promise<void> {
  // Stop day-tracking FIRST — while the token still exists so the server
  // session closes cleanly. stopDayTracking() sends the native ACTION_STOP,
  // which removes the persistent "day tracking on" notification, clears
  // KEY_ACTIVE (so the boot receiver won't restart it), stops the GPS
  // task/watch, and deletes the day/session SecureStore keys. setNativeSignedIn
  // (false) is a belt-and-suspenders guard: even if the stop is missed, the
  // native service refuses to run (and won't restart on boot) while signed out.
  try {
    const gps = await import("./gps");
    await gps.setNativeSignedIn(false);
    // Local-only stop: never end the SERVER session on logout. Accounts are
    // shared (a manager/client may open a field worker's account to view), and
    // the session is per-USER — ending it here would kill the worker's live run
    // on their own phone. SE days end via the 8 PM cron; Logistics via "End run".
    await gps.stopDayTracking({ endServerSession: false });
  } catch {
    // best-effort — never block logout on a tracking-stop failure
  }
  // Best-effort beacon: tell the server this device signed out, so the live
  // tracking map shows a calm "Signed out" for this executive instead of the red
  // "Tracking interrupted" reserved for an unexplained loss of contact. Fired
  // while the token + Neon session still exist (deleted below). Offline or an
  // expired token just falls back to the time-based status — never blocks logout.
  try {
    const [token, rawUser] = await Promise.all([storage.get(TOKEN_KEY), storage.get(USER_KEY)]);
    const role = rawUser ? (JSON.parse(rawUser) as AuthUser).role : null;
    if (token && (role === "SALES_EXECUTIVE" || role === "LOGISTICS")) {
      await apiFetch("/tracking-sessions/signed-out", { method: "POST", token });
    }
  } catch {
    // never block logout on a beacon failure
  }
  // Cancel any scheduled reminder alarms + clear tray notifications so they
  // never fire for whoever signs in next on this device.
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  // Wipe all cached/offline data (customers, orders, collections, invoices,
  // performance, history, reminders) so the next sign-in starts clean.
  const db = getLocalDb();
  if (db) {
    try {
      clearAllLocalData(db);
    } catch {
      // Best-effort — never block logout on a cache-clear failure.
    }
  }
  // Drop the in-memory React Query cache too, so a logout→login on the same
  // device (no app restart) can't briefly show the previous user's screens.
  queryClient.clear();
  // Best-effort revoke of the Neon session on this device.
  try {
    const session = await storage.get(SESSION_KEY);
    if (session) await neonSignOut(session);
  } catch {
    // never block logout on a sign-out failure
  }
  await Promise.all([storage.del(TOKEN_KEY), storage.del(USER_KEY), storage.del(SESSION_KEY)]);
  set({ token: null, user: null });
}
