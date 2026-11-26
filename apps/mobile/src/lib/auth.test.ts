import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "./auth";

// Capture the module-load closures auth.ts registers.
const cap = vi.hoisted(() => ({
  handlers: null as null | { onRefresh?: (t: string) => void; onExpired?: () => void },
  minter: null as null | (() => Promise<{ status: string; token?: string }>),
}));

const login = vi.fn();
const logout = vi.fn();
vi.mock("./auth-actions", () => ({ login: (...a: unknown[]) => login(...a), logout: (...a: unknown[]) => logout(...a) }));
vi.mock("./auth-events", () => ({ setAuthEventHandlers: (h: typeof cap.handlers) => { cap.handlers = h; } }));
vi.mock("./token-refresh", () => ({ setTokenMinter: (m: typeof cap.minter) => { cap.minter = m; } }));

const storageGet = vi.fn();
const storageSet = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const storageDel = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./auth-storage", () => ({
  storage: { get: (...a: unknown[]) => storageGet(...a), set: (...a: unknown[]) => storageSet(...a), del: (...a: unknown[]) => storageDel(...a) },
  TOKEN_KEY: "TOKEN",
  USER_KEY: "USER",
  SESSION_KEY: "SESSION",
}));
const neonProbeSession = vi.fn();
vi.mock("./neon-auth", () => ({ neonProbeSession: (...a: unknown[]) => neonProbeSession(...a) }));
const setNativeSignedIn = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./gps", () => ({ setNativeSignedIn: (...a: unknown[]) => setNativeSignedIn(...a) }));

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  useAuth.setState({ token: null, user: null, hydrated: false });
});
afterEach(() => vi.clearAllMocks());

describe("useAuth store", () => {
  it("hydrate loads the token + user and re-arms native tracking", async () => {
    storageGet.mockImplementation((k: string) => Promise.resolve(k === "TOKEN" ? "tok" : JSON.stringify({ id: "u1", name: "N" })));
    await useAuth.getState().hydrate();
    expect(useAuth.getState()).toMatchObject({ token: "tok", user: { id: "u1" }, hydrated: true });
    await flush();
    expect(setNativeSignedIn).toHaveBeenCalledWith(true);
  });

  it("hydrate with no stored token leaves the user null and skips native re-arm", async () => {
    storageGet.mockResolvedValue(null);
    await useAuth.getState().hydrate();
    expect(useAuth.getState()).toMatchObject({ token: null, user: null, hydrated: true });
    await flush();
    expect(setNativeSignedIn).not.toHaveBeenCalled();
  });

  it("login delegates to the login action with the store setter", () => {
    useAuth.getState().login("e@x.com", "pw");
    expect(login).toHaveBeenCalledWith(expect.any(Function), "e@x.com", "pw");
  });

  it("logout delegates to the logout action", () => {
    useAuth.getState().logout();
    expect(logout).toHaveBeenCalledWith(expect.any(Function));
  });

  describe("applyRefreshedToken", () => {
    it("adopts a real, changed token", async () => {
      useAuth.setState({ token: "old" });
      await useAuth.getState().applyRefreshedToken("new");
      expect(useAuth.getState().token).toBe("new");
      expect(storageSet).toHaveBeenCalledWith("TOKEN", "new");
      await flush();
      expect(setNativeSignedIn).toHaveBeenCalledWith(true);
    });
    it("ignores an empty token, a signed-out session, or an unchanged token", async () => {
      useAuth.setState({ token: "old" });
      await useAuth.getState().applyRefreshedToken("");
      await useAuth.getState().applyRefreshedToken("old");
      useAuth.setState({ token: null });
      await useAuth.getState().applyRefreshedToken("new");
      expect(storageSet).not.toHaveBeenCalled();
    });
  });

  describe("expireSession", () => {
    it("drops only the token, keeping the user", async () => {
      useAuth.setState({ token: "tok", user: { id: "u1", name: "N", email: "e", role: null, enterpriseId: null } });
      await useAuth.getState().expireSession();
      expect(useAuth.getState().token).toBeNull();
      expect(useAuth.getState().user).not.toBeNull();
      expect(storageDel).toHaveBeenCalledWith("TOKEN");
    });
    it("is a no-op when already signed out", async () => {
      await useAuth.getState().expireSession();
      expect(storageDel).not.toHaveBeenCalled();
    });
  });

  describe("updateUser", () => {
    it("merges + persists a profile patch", async () => {
      useAuth.setState({ user: { id: "u1", name: "Old", email: "e", role: "SALES_EXECUTIVE", enterpriseId: null } });
      await useAuth.getState().updateUser({ name: "New" });
      expect(useAuth.getState().user?.name).toBe("New");
      expect(storageSet).toHaveBeenCalledWith("USER", expect.stringContaining("New"));
    });
    it("is a no-op with no cached user", async () => {
      await useAuth.getState().updateUser({ name: "New" });
      expect(storageSet).not.toHaveBeenCalled();
    });
  });

  describe("registered auth-event handlers", () => {
    it("onRefresh adopts a token; onExpired soft-expires", async () => {
      useAuth.setState({ token: "old" });
      cap.handlers!.onRefresh!("fresh");
      await flush();
      expect(useAuth.getState().token).toBe("fresh");
      cap.handlers!.onExpired!();
      await flush();
      expect(useAuth.getState().token).toBeNull();
    });
  });

  describe("token minter", () => {
    it("returns revoked when there is no stored Neon session", async () => {
      storageGet.mockResolvedValue(null);
      await expect(cap.minter!()).resolves.toEqual({ status: "revoked" });
    });
    it("mints + adopts a fresh token from an active session", async () => {
      storageGet.mockResolvedValue("sess");
      neonProbeSession.mockResolvedValue({ status: "active", token: "minted" });
      await expect(cap.minter!()).resolves.toEqual({ status: "active", token: "minted" });
      expect(useAuth.getState().token).toBe("minted");
      expect(storageSet).toHaveBeenCalledWith("TOKEN", "minted");
      await flush();
      expect(setNativeSignedIn).toHaveBeenCalledWith(true);
    });
    it("swallows a native re-arm failure on the mint path", async () => {
      storageGet.mockResolvedValue("sess");
      neonProbeSession.mockResolvedValue({ status: "active", token: "minted" });
      setNativeSignedIn.mockRejectedValue(new Error("native"));
      await cap.minter!();
      await new Promise((r) => setTimeout(r, 20));
      expect(setNativeSignedIn).toHaveBeenCalledWith(true);
    });
    it("maps a revoked probe to revoked and anything else to unavailable", async () => {
      storageGet.mockResolvedValue("sess");
      neonProbeSession.mockResolvedValue({ status: "revoked" });
      await expect(cap.minter!()).resolves.toEqual({ status: "revoked" });
      neonProbeSession.mockResolvedValue({ status: "network-down" });
      await expect(cap.minter!()).resolves.toEqual({ status: "unavailable" });
    });
  });

  it("swallows storage + native re-arm failures across refresh, expire and mint", async () => {
    setNativeSignedIn.mockRejectedValue(new Error("native down"));
    storageSet.mockRejectedValue(new Error("set failed"));
    storageDel.mockRejectedValue(new Error("del failed"));
    storageGet.mockResolvedValue("sess");
    neonProbeSession.mockResolvedValue({ status: "active", token: "minted" });

    useAuth.setState({ token: "old" });
    await useAuth.getState().applyRefreshedToken("new"); // storage.set + gps .catch
    useAuth.setState({ token: "tok" });
    await useAuth.getState().expireSession(); // storage.del .catch
    await cap.minter!(); // storage.set + gps .catch (mint path)
    await flush();
    await flush(); // let the mint path's fire-and-forget gps chain settle
    // No unhandled rejection = every .catch guard held.
    expect(setNativeSignedIn).toHaveBeenCalled();
  });
});
