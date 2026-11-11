/**
 * Persistence + shared types for the auth store. Split out of auth.ts so the
 * store module stays small; the single zustand instance still lives in auth.ts.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const TOKEN_KEY = "distribution_os_auth_token";
export const USER_KEY = "distribution_os_auth_user";
/** Neon Auth session cookie value — the long-lived credential JWTs are minted from. */
export const SESSION_KEY = "distribution_os_neon_session";
/** Id of the last user who signed in on this (shared) device. Used to detect a
 *  user SWITCH on login and wipe the previous user's local data. Deliberately
 *  device-global (NOT cleared on logout), so a different next-user is detected
 *  even if a logout wipe was interrupted. */
export const LAST_USER_KEY = "distribution_os_last_user_id";

// expo-secure-store has no web implementation; the web build (dev preview
// only — the shipped app is native) falls back to localStorage.
export const storage =
  Platform.OS === "web"
    ? {
        get: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
        set: async (key: string, value: string) => {
          globalThis.localStorage?.setItem(key, value);
        },
        del: async (key: string) => {
          globalThis.localStorage?.removeItem(key);
        },
      }
    : {
        get: SecureStore.getItemAsync,
        set: SecureStore.setItemAsync,
        del: SecureStore.deleteItemAsync,
      };

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  /** The enterprise this user belongs to (multi-enterprise). Server-resolved;
   *  the app's data is already enterprise-scoped server-side, this is for
   *  reference/debugging and future per-enterprise client logic. */
  enterpriseId: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

/** Narrow zustand setter — every call in the store/actions passes a partial. */
export type AuthSet = (partial: Partial<AuthState>) => void;

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True once the secure store has been read at startup. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Adopt a server-refreshed token (X-Refresh-Token) so it never ages out. */
  applyRefreshedToken: (token: string) => Promise<void>;
  /** Soft re-auth on a dead token: drop the session so the gate routes to
   *  login, but keep cached data + the offline write queue intact. */
  expireSession: () => Promise<void>;
  /** Merge fields into the cached user and persist (e.g. after a profile edit). */
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
}
