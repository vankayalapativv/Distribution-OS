/**
 * The login action for the auth store (with the role gate + shared-device
 * hygiene). Split out of auth-actions.ts to keep each action file small; it
 * receives the store's `set` and mutates it exactly as the inline version did.
 */
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
import { isMobileRole } from "./auth-roles";
import { wipePreviousUserData } from "./auth-wipe";
import { neonJwtFromSession, neonSignIn, neonSignOut } from "./neon-auth";
import { rearmNativeTracking } from "./native-rearm";

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
  // — who get their own admin area. MANAGER / ACCOUNTANT remain web-only (see
  // ./auth-roles — the exact complement of the web's isWebRole gate). The check
  // runs only AFTER a correct password, so a wrong-platform account is told where
  // to go rather than getting a confusing "invalid credentials".
  if (!isMobileRole(role)) {
    // Revoke the session we just created so a wrong-platform (or not-yet-
    // provisioned) account leaves no live session behind on this shared device.
    await neonSignOut(session);
    throw new ApiRequestError(
      "FORBIDDEN",
      "This app is for Sales Executives, Logistics, and Super Admins. Managers and Accountants use the web dashboard.",
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
  void rearmNativeTracking();
}
