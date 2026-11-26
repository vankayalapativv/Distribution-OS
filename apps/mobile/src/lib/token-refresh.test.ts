import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureFreshToken, refreshAccessToken, setTokenMinter, type RefreshOutcome } from "./token-refresh";

function jwt(expSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");
  return `h.${body}.sig`;
}
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("refreshAccessToken", () => {
  it("returns revoked when no minter is registered", async () => {
    setTokenMinter(null as never);
    expect(await refreshAccessToken()).toEqual({ status: "revoked" });
  });
  it("single-flights concurrent refreshes through one minter call", async () => {
    let release!: (o: RefreshOutcome) => void;
    const minter = vi.fn(() => new Promise<RefreshOutcome>((r) => { release = r; }));
    setTokenMinter(minter);
    const a = refreshAccessToken();
    const b = refreshAccessToken();
    expect(a).toBe(b); // same in-flight promise
    expect(minter).toHaveBeenCalledTimes(1);
    release({ status: "active", token: "t1" });
    expect(await a).toEqual({ status: "active", token: "t1" });
  });
  it("treats a thrown minter as unavailable (never a logout)", async () => {
    setTokenMinter(() => Promise.reject(new Error("dns")));
    expect(await refreshAccessToken()).toEqual({ status: "unavailable" });
  });
});

describe("ensureFreshToken", () => {
  it("passes a null token straight through", async () => {
    expect(await ensureFreshToken(null)).toBeNull();
  });
  it("keeps a token whose expiry can't be read", async () => {
    expect(await ensureFreshToken("not-a-jwt")).toBe("not-a-jwt");
  });
  it("keeps a token whose payload carries no numeric exp", async () => {
    const noExp = `h.${Buffer.from(JSON.stringify({ sub: "u1" })).toString("base64url")}.sig`;
    expect(await ensureFreshToken(noExp)).toBe(noExp);
  });
  it("keeps a token whose payload isn't valid JSON (decode throws)", async () => {
    const garbage = `h.${Buffer.from("not-json").toString("base64url")}.sig`;
    expect(await ensureFreshToken(garbage)).toBe(garbage);
  });
  it("degrades safely when atob is unavailable", async () => {
    vi.stubGlobal("atob", undefined);
    expect(await ensureFreshToken(jwt(Math.floor(Date.now() / 1000) + 9999))).toMatch(/^h\./);
  });
  it("keeps a token with comfortable life left (no mint)", async () => {
    const minter = vi.fn(() => Promise.resolve({ status: "active", token: "new" } as RefreshOutcome));
    setTokenMinter(minter);
    const fresh = jwt(Math.floor(Date.now() / 1000) + 600); // 10 min out
    expect(await ensureFreshToken(fresh)).toBe(fresh);
    expect(minter).not.toHaveBeenCalled();
  });
  it("mints a fresh token when near expiry", async () => {
    setTokenMinter(() => Promise.resolve({ status: "active", token: "minted" }));
    const soon = jwt(Math.floor(Date.now() / 1000) + 30); // within the 2-min skew
    expect(await ensureFreshToken(soon)).toBe("minted");
  });
  it("falls back to the current token when the proactive mint can't mint", async () => {
    setTokenMinter(() => Promise.resolve({ status: "unavailable" }));
    const soon = jwt(Math.floor(Date.now() / 1000) + 30);
    expect(await ensureFreshToken(soon)).toBe(soon);
  });
});
