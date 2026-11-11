import { create } from "zustand";
import * as actions from "./auth-actions";
import { setAuthEventHandlers } from "./auth-events";
import {
  type AuthState,
  type AuthUser,
  SESSION_KEY,
  storage,
  TOKEN_KEY,
  USER_KEY,
} from "./auth-storage";
import { neonProbeSession } from "./neon-auth";
import { setTokenMinter } from "./token-refresh";

export type { AuthUser };

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    const [token, userJson] = await Promise.all([
      storage.get(TOKEN_KEY),
      storage.get(USER_KEY),
    ]);
    set({
      token,
      user: userJson ? (JSON.parse(userJson) as AuthUser) : null,
      hydrated: true,
    });
    // Re-affirm the native "signed in" guard for an already-logged-in install.
    if (token) void import("./gps").then((gps) => gps.setNativeSignedIn(true)).catch(() => undefined);
  },

  login: (email, password) => actions.login(set, email, password),

  applyRefreshedToken: async (token) => {
    const current = useAuth.getState().token;
    // Only adopt a real, changed token, and never resurrect a signed-out
    // session (a stale in-flight response could arrive just after logout).
    if (!token || !current || token === current) return;
    set({ token });
    await storage.set(TOKEN_KEY, token).catch(() => undefined);
    // Hand the fresh token to the native GPS uploader too, so background pings
    // keep authenticating without waiting for the next app-open.
    void import("./gps").then((gps) => gps.setNativeSignedIn(true)).catch(() => undefined);
  },

  expireSession: async () => {
    // Drop ONLY the token — deliberately NOT the full logout(), which stops
    // tracking and clears the offline queue. Keeping the queue means the pings /
    // orders / collections captured on the dead token flush once the user signs
    // back in. `user` is kept so the login screen can greet them by name.
    if (!useAuth.getState().token) return;
    await storage.del(TOKEN_KEY).catch(() => undefined);
    set({ token: null });
  },

  logout: () => actions.logout(set),

  updateUser: async (patch) => {
    const current = useAuth.getState().user;
    if (!current) return;
    const next = { ...current, ...patch };
    await storage.set(USER_KEY, JSON.stringify(next));
    set({ user: next });
  },
}));

// Bridge the low-level API client's session events into the store: silently
// adopt server-refreshed tokens, and soft-expire the session on a dead token.
setAuthEventHandlers({
  onRefresh: (token) => void useAuth.getState().applyRefreshedToken(token),
  onExpired: () => void useAuth.getState().expireSession(),
});

// Inject the real refresh into token-refresh.ts: read the stored Neon session,
// mint a fresh EdDSA JWT from it, and adopt it. Reading SESSION_KEY here also
// makes this resurrection-safe — logout deletes SESSION_KEY, so a stray refresh
// after sign-out finds no session and returns null instead of re-authenticating.
setTokenMinter(async () => {
  const session = await storage.get(SESSION_KEY);
  if (!session) return { status: "revoked" };
  // Probe (not a blind mint) so a network/DNS failure is classified as
  // "unavailable" (keep the user signed in) rather than conflated with a
  // revoked session — the fix for field reps being logged out on weak 4G.
  const { status, token } = await neonProbeSession(session);
  if (status === "active" && token) {
    // Persist + adopt into the live store (and re-arm the native GPS uploader).
    await storage.set(TOKEN_KEY, token).catch(() => undefined);
    useAuth.setState({ token });
    void import("./gps").then((gps) => gps.setNativeSignedIn(true)).catch(() => undefined);
    return { status: "active", token };
  }
  return status === "revoked" ? { status: "revoked" } : { status: "unavailable" };
});
