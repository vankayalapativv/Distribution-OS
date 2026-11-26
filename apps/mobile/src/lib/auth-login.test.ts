import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "./auth-login";
import { ApiRequestError } from "./api";

const apiFetch = vi.fn();
vi.mock("./api", () => {
  class MockApiError extends Error {
    constructor(public code: string, message: string, public status: number) {
      super(message);
    }
  }
  return { apiFetch: (...a: unknown[]) => apiFetch(...a), ApiRequestError: MockApiError };
});

const storageGet = vi.fn();
const storageSet = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./auth-storage", () => ({
  storage: { get: (...a: unknown[]) => storageGet(...a), set: (...a: unknown[]) => storageSet(...a), del: vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve()) },
  TOKEN_KEY: "TOKEN",
  USER_KEY: "USER",
  SESSION_KEY: "SESSION",
  LAST_USER_KEY: "LAST",
}));

const isMobileRole = vi.fn();
vi.mock("./auth-roles", () => ({ isMobileRole: (...a: unknown[]) => isMobileRole(...a) }));

const wipePreviousUserData = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./auth-wipe", () => ({ wipePreviousUserData: (...a: unknown[]) => wipePreviousUserData(...a) }));

const neonSignIn = vi.fn();
const neonJwtFromSession = vi.fn();
const neonSignOut = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./neon-auth", () => ({
  neonSignIn: (...a: unknown[]) => neonSignIn(...a),
  neonJwtFromSession: (...a: unknown[]) => neonJwtFromSession(...a),
  neonSignOut: (...a: unknown[]) => neonSignOut(...a),
}));

const setNativeSignedIn = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./gps", () => ({ setNativeSignedIn: (...a: unknown[]) => setNativeSignedIn(...a) }));

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  neonSignIn.mockResolvedValue({ session: "sess", user: { id: "nid", name: "Neo", email: "neo@x.com" } });
  neonJwtFromSession.mockResolvedValue("token-1");
  apiFetch.mockResolvedValue({ auth: { role: "SALES_EXECUTIVE", userId: "uid-1", enterpriseId: "ent-1" } });
  isMobileRole.mockReturnValue(true);
  storageGet.mockResolvedValue("uid-1"); // same prior user → no wipe
});

afterEach(() => vi.clearAllMocks());

describe("login", () => {
  it("signs in a mobile-role user and commits the token + profile", async () => {
    const set = vi.fn();
    await login(set, "neo@x.com", "pw");
    expect(set).toHaveBeenCalledWith({
      token: "token-1",
      user: { id: "uid-1", name: "Neo", email: "neo@x.com", role: "SALES_EXECUTIVE", enterpriseId: "ent-1" },
    });
    expect(wipePreviousUserData).not.toHaveBeenCalled();
    expect(storageSet).toHaveBeenCalledWith("SESSION", "sess");
    expect(storageSet).toHaveBeenCalledWith("TOKEN", "token-1");
    await flush();
    expect(setNativeSignedIn).toHaveBeenCalledWith(true);
  });

  it("throws AUTH_ERROR when no session token can be minted", async () => {
    neonJwtFromSession.mockResolvedValue(null);
    await expect(login(vi.fn(), "e", "p")).rejects.toMatchObject({ code: "AUTH_ERROR", status: 500 });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects a web-only role, revoking the just-created session", async () => {
    isMobileRole.mockReturnValue(false);
    apiFetch.mockResolvedValue({ auth: { role: "MANAGER", userId: "uid-1", enterpriseId: null } });
    const set = vi.fn();
    await expect(login(set, "e", "p")).rejects.toBeInstanceOf(ApiRequestError);
    expect(neonSignOut).toHaveBeenCalledWith("sess");
    expect(set).not.toHaveBeenCalled();
  });

  it("wipes the previous user's data when a different user signs in", async () => {
    storageGet.mockResolvedValue("someone-else");
    await login(vi.fn(), "e", "p");
    expect(wipePreviousUserData).toHaveBeenCalledWith("someone-else");
    expect(storageSet).toHaveBeenCalledWith("LAST", "uid-1");
  });

  it("falls back to the Neon id and null enterprise when /me omits them", async () => {
    apiFetch.mockResolvedValue({ auth: { role: "LOGISTICS", userId: null, enterpriseId: null } });
    const set = vi.fn();
    await login(set, "e", "p");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: "nid", enterpriseId: null }) }));
  });

  it("completes the sign-in even if the shared-device hygiene step throws", async () => {
    storageGet.mockRejectedValue(new Error("secure store busy"));
    const set = vi.fn();
    await expect(login(set, "e", "p")).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledOnce();
  });

  it("does not throw if re-arming native tracking fails", async () => {
    setNativeSignedIn.mockRejectedValue(new Error("native down"));
    await expect(login(vi.fn(), "e", "p")).resolves.toBeUndefined();
    await flush();
  });
});
