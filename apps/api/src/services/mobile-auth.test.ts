import { afterEach, describe, expect, it, vi } from "vitest";
import { neonChangePassword, neonMintToken, neonSignIn, neonSignOut } from "./mobile-auth";

const ENV = { NEON_AUTH_BASE_URL: "https://auth.neon.test/", NEON_AUTH_ORIGIN: "http://localhost:3000" } as never;
const SESSION = "sess-abc";
const COOKIE = `__Secure-neon-auth.session_token=${SESSION}; Path=/; HttpOnly`;

const res = (body: unknown, init: ResponseInit = {}) =>
  new Response(body === null ? "" : JSON.stringify(body), { status: 200, ...init });

afterEach(() => vi.restoreAllMocks());

describe("neonSignIn", () => {
  it("returns the session + user on success", async () => {
    const user = { id: "u1", name: "Asha", email: "a@b.c" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({ user }, { headers: { "set-cookie": COOKIE } }));
    const out = await neonSignIn(ENV, "a@b.c", "pw");
    expect(out).toEqual({ ok: true, session: SESSION, user });
  });

  it("forwards the device user-agent to Neon so the session is labelled", async () => {
    const user = { id: "u1", name: "Asha", email: "a@b.c" };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(res({ user }, { headers: { "set-cookie": COOKIE } }));
    await neonSignIn(ENV, "a@b.c", "pw", "DistributionOS/1.1.2 (Android 13; samsung; SM-G991B)");
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["user-agent"]).toBe(
      "DistributionOS/1.1.2 (Android 13; samsung; SM-G991B)",
    );
  });

  it("omits the user-agent header when no device string is given", async () => {
    const user = { id: "u1", name: "Asha", email: "a@b.c" };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(res({ user }, { headers: { "set-cookie": COOKIE } }));
    await neonSignIn(ENV, "a@b.c", "pw");
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["user-agent"]).toBeUndefined();
  });

  it("maps 401/403 from Neon to bad-credentials (401)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({ message: "nope" }, { status: 401 }));
    expect(await neonSignIn(ENV, "a@b.c", "bad")).toEqual({ ok: false, status: 401, error: "nope" });
  });

  it("maps any other upstream status to 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({}, { status: 500 }));
    expect(await neonSignIn(ENV, "a@b.c", "pw")).toMatchObject({ ok: false, status: 503 });
  });

  it("returns 503 when the server is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("dns"));
    expect(await neonSignIn(ENV, "a@b.c", "pw")).toMatchObject({ ok: false, status: 503 });
  });

  it("returns 503 when the response carries no session cookie", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({ user: { id: "u1" } })); // no set-cookie
    expect(await neonSignIn(ENV, "a@b.c", "pw")).toMatchObject({ ok: false, status: 503 });
  });
});

describe("neonMintToken", () => {
  it("returns an active token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({ token: "jwt-123" }));
    expect(await neonMintToken(ENV, SESSION)).toEqual({ status: "active", token: "jwt-123" });
  });

  it("reports a revoked session on 401/403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({}, { status: 403 }));
    expect(await neonMintToken(ENV, SESSION)).toEqual({ status: "revoked" });
  });

  it("reports unavailable on an outage or an empty token", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("down"));
    expect(await neonMintToken(ENV, SESSION)).toEqual({ status: "unavailable" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({}));
    expect(await neonMintToken(ENV, SESSION)).toEqual({ status: "unavailable" });
  });
});

describe("neonSignOut", () => {
  it("swallows any error (best-effort)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    await expect(neonSignOut(ENV, SESSION)).resolves.toBeUndefined();
  });
});

describe("neonChangePassword", () => {
  it("succeeds and keeps other sessions alive (revokeOtherSessions:false)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res({}));
    expect(await neonChangePassword(ENV, SESSION, "old", "abcd1234")).toEqual({ ok: true });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ currentPassword: "old", newPassword: "abcd1234", revokeOtherSessions: false });
  });
  it("maps a 400 to the wrong-current-password message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({ message: "Invalid password" }, { status: 400 }));
    expect(await neonChangePassword(ENV, SESSION, "bad", "abcd1234")).toEqual({ ok: false, status: 400, error: "Invalid password" });
  });
  it("defaults the 400 message when the body has none", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res(null, { status: 400 }));
    expect(await neonChangePassword(ENV, SESSION, "bad", "abcd1234")).toEqual({ ok: false, status: 400, error: "Your current password is incorrect." });
  });
  it("maps any other upstream status to 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({}, { status: 500 }));
    expect(await neonChangePassword(ENV, SESSION, "old", "abcd1234")).toMatchObject({ ok: false, status: 503 });
  });
  it("returns 503 when Neon is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect(await neonChangePassword(ENV, SESSION, "old", "abcd1234")).toMatchObject({ ok: false, status: 503 });
  });
});
