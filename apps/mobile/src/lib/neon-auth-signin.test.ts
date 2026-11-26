import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { neonJwtFromSession, neonProbeSession, neonSignIn, neonSignOut } from "./neon-auth";

// Null device/app info → exercises the deviceUserAgent fallbacks.
vi.mock("expo-device", () => ({ manufacturer: null, modelName: null, osVersion: null }));
vi.mock("expo-constants", () => ({ default: { expoConfig: {} } }));

const env = (status: number, data: unknown, success = true) =>
  new Response(JSON.stringify({ success, data }), { status, headers: { "Content-Type": "application/json" } });
const errEnv = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), { status });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.useFakeTimers(); fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("neonSignIn retry + device string", () => {
  it("retries a transient network failure, then succeeds with the fallback device string", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("dns"))
      .mockRejectedValueOnce(new Error("dns"))
      .mockResolvedValue(env(200, { session: "s1", token: "J", user: { id: "u1", name: "A", email: "a@b.c" } }));
    const p = neonSignIn("a@b.c", "pw");
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(800);
    expect(await p).toEqual({ session: "s1", user: { id: "u1", name: "A", email: "a@b.c" } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.device).toBe("DistributionOS/0 (Android ?; Unknown; device)");
  });

  it("gives up after three failed network attempts", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const p = neonSignIn("a@b.c", "pw");
    const assertion = expect(p).rejects.toThrow("offline");
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(800);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws the server's error on a non-OK response", async () => {
    fetchMock.mockResolvedValue(errEnv(401, "BAD_CREDENTIALS", "Wrong password."));
    await expect(neonSignIn("a@b.c", "pw")).rejects.toMatchObject({ code: "BAD_CREDENTIALS", status: 401 });
  });

  it("defaults the error code/message when the server omits them", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 403 }));
    await expect(neonSignIn("a@b.c", "pw")).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 403 });
  });

  it("errors when sign-in returns no session/user", async () => {
    fetchMock.mockResolvedValue(env(200, { session: null, user: null }));
    await expect(neonSignIn("a@b.c", "pw")).rejects.toMatchObject({ code: "AUTH_ERROR" });
  });

  it("surfaces a non-JSON body as a clean error", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    await expect(neonSignIn("a@b.c", "pw")).rejects.toMatchObject({ code: "NON_JSON_RESPONSE", status: 502 });
  });

  it("aborts a stalled sign-in after the 15s timeout", async () => {
    fetchMock.mockImplementation((_u: string, init: { signal: AbortSignal }) =>
      new Promise((_res, rej) => { init.signal.addEventListener("abort", () => rej(new Error("aborted"))); }),
    );
    const p = neonSignIn("a@b.c", "pw");
    const assertion = expect(p).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15_000); // attempt 0 aborts
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(15_000); // attempt 1 aborts
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(15_000); // attempt 2 aborts → throw
    await assertion;
  });
});

describe("neonJwtFromSession", () => {
  it("returns the fresh token when active", async () => {
    fetchMock.mockResolvedValue(env(200, { status: "active", token: "FRESH" }));
    expect(await neonJwtFromSession("s")).toBe("FRESH");
  });
  it("returns null on a non-OK response", async () => {
    fetchMock.mockResolvedValue(env(500, null, false));
    expect(await neonJwtFromSession("s")).toBeNull();
  });
  it("returns null when not active (or no token)", async () => {
    fetchMock.mockResolvedValue(env(200, { status: "revoked" }));
    expect(await neonJwtFromSession("s")).toBeNull();
  });
  it("returns null when active but no token is present", async () => {
    fetchMock.mockResolvedValue(env(200, { status: "active" }));
    expect(await neonJwtFromSession("s")).toBeNull();
  });
  it("returns null when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await neonJwtFromSession("s")).toBeNull();
  });
});

describe("neonProbeSession envelope-failure", () => {
  it("is unavailable when a 200 response reports success:false", async () => {
    fetchMock.mockResolvedValue(env(200, null, false));
    expect(await neonProbeSession("s")).toEqual({ status: "unavailable", token: null });
  });
});

describe("neonSignOut", () => {
  it("posts the sign-out and swallows any failure", async () => {
    fetchMock.mockResolvedValue(env(200, {}));
    await expect(neonSignOut("s")).resolves.toBeUndefined();
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(neonSignOut("s")).resolves.toBeUndefined();
  });
});
