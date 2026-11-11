import { describe, expect, it, vi } from "vitest";

// Control what userId the key helpers see.
const authState: { user: { id: string } | null } = { user: null };
vi.mock("./auth", () => ({ useAuth: { getState: () => authState } }));

import {
  CLIENT_SESSION_KEY,
  DAY_ENDED_KEY,
  DAY_ON_KEY,
  DAY_START_ODO_KEY,
  LEGACY_UNSCOPED_KEYS,
  SERVER_SESSION_KEY,
  scopedKeysFor,
} from "./gps-config";
import {
  clientSessionKey,
  dayEndedKey,
  dayOnKey,
  dayStartOdoKey,
  serverSessionKey,
} from "./gps-keys";

// SecureStore only accepts keys matching this; anything else throws "Invalid key"
// (which our `.catch`es swallow), so a bad separator silently breaks persistence.
const SECURE_STORE_KEY = /^[\w.-]+$/;

describe("gps per-user SecureStore keys", () => {
  it("falls back to the bare base key when no user is signed in", () => {
    authState.user = null;
    expect(dayOnKey()).toBe(DAY_ON_KEY);
    expect(clientSessionKey()).toBe(CLIENT_SESSION_KEY);
    expect(serverSessionKey()).toBe(SERVER_SESSION_KEY);
  });

  it("namespaces every key by the signed-in userId", () => {
    authState.user = { id: "u-123" };
    expect(dayOnKey()).toBe(`${DAY_ON_KEY}.u-123`);
    expect(dayStartOdoKey()).toBe(`${DAY_START_ODO_KEY}.u-123`);
    expect(clientSessionKey()).toBe(`${CLIENT_SESSION_KEY}.u-123`);
    expect(serverSessionKey()).toBe(`${SERVER_SESSION_KEY}.u-123`);
  });

  it("produces keys SecureStore accepts (valid chars only) for a UUID userId", () => {
    // A real userId is a UUID (hex + hyphens). The scoped key must match the
    // SecureStore key charset — a ':' separator does NOT, and silently breaks writes.
    authState.user = { id: "dfd6a952-f3bb-4fe8-b16e-3d9e6df706a0" };
    for (const key of [dayOnKey(), dayEndedKey(), clientSessionKey(), serverSessionKey()]) {
      expect(key).toMatch(SECURE_STORE_KEY);
      expect(key).not.toContain(":");
    }
  });

  it("gives two users disjoint keys on a shared device (no state leak)", () => {
    authState.user = { id: "alice" };
    const alice = dayOnKey();
    authState.user = { id: "bob" };
    expect(dayOnKey()).not.toBe(alice);
  });

  it("scopedKeysFor builds every scoped key for an EXPLICIT user (shared-device wipe)", () => {
    // Used at login to scrub a PRIOR user's keys — the store user is not yet
    // that prior user, so it must take the id explicitly.
    const id = "dfd6a952-f3bb-4fe8-b16e-3d9e6df706a0";
    const keys = scopedKeysFor(id);
    expect(keys).toEqual([
      `${DAY_ON_KEY}.${id}`,
      `${DAY_ENDED_KEY}.${id}`,
      `${DAY_START_ODO_KEY}.${id}`,
      `${CLIENT_SESSION_KEY}.${id}`,
      `${SERVER_SESSION_KEY}.${id}`,
    ]);
    for (const key of keys) {
      expect(key).toMatch(SECURE_STORE_KEY);
      expect(key).not.toContain(":");
    }
  });

  it("exposes the legacy unscoped bases for one-time cleanup", () => {
    expect([...LEGACY_UNSCOPED_KEYS]).toEqual([
      DAY_ON_KEY,
      DAY_START_ODO_KEY,
      CLIENT_SESSION_KEY,
      SERVER_SESSION_KEY,
    ]);
    // Sanity: the base keys themselves are valid SecureStore keys.
    for (const k of [DAY_ON_KEY, DAY_ENDED_KEY, DAY_START_ODO_KEY, CLIENT_SESSION_KEY, SERVER_SESSION_KEY]) {
      expect(k).toMatch(SECURE_STORE_KEY);
    }
  });
});
