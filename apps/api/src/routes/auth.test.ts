import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, installAuth } from "../test/route-harness";

const M = vi.hoisted(() => ({
  signIn: vi.fn(), mint: vi.fn(), signOut: vi.fn(), db: {} as Record<string, unknown[]>,
}));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => M.db) };
});
vi.mock("../services/mobile-auth", () => ({
  neonSignIn: (...a: unknown[]) => M.signIn(...a),
  neonMintToken: (...a: unknown[]) => M.mint(...a),
  neonSignOut: (...a: unknown[]) => M.signOut(...a),
}));

const post = async (p: string, b: unknown) => {
  const { default: app } = await import("../index");
  return app.request(`/api/v1/auth/${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }, ENV);
};

beforeEach(() => { vi.resetModules(); installAuth(); M.signIn.mockReset(); M.mint.mockReset(); M.signOut.mockReset(); M.db = {}; });

describe("auth routes (public)", () => {
  it("login returns session+token when sign-in and mint succeed", async () => {
    M.signIn.mockResolvedValue({ ok: true, session: "sess", user: { id: "u1" } });
    M.mint.mockResolvedValue({ status: "active", token: "jwt" });
    const res = await post("login", { email: "a@b.c", password: "pw" });
    expect(res.status).toBe(200);
    expect((await res.json()).data.token).toBe("jwt");
  });
  it("resolves a phone identifier to its account email, then signs in", async () => {
    M.db = { login_resolve_email_by_phone: [{ email: "se@x.com" }] };
    M.signIn.mockResolvedValue({ ok: true, session: "sess", user: { id: "u1" } });
    M.mint.mockResolvedValue({ status: "active", token: "jwt" });
    const res = await post("login", { identifier: "99852 94475", password: "pw" });
    expect(res.status).toBe(200);
    // Signed in with the resolved email, not the raw phone.
    expect(M.signIn).toHaveBeenLastCalledWith(expect.anything(), "se@x.com", "pw", undefined);
  });
  it("401s a phone that matches no active user (no enumeration)", async () => {
    M.db = { login_resolve_email_by_phone: [] };
    const res = await post("login", { identifier: "9000000000", password: "pw" });
    expect(res.status).toBe(401);
    expect(M.signIn).not.toHaveBeenCalled();
  });
  it("login returns null token when the mint is not active", async () => {
    M.signIn.mockResolvedValue({ ok: true, session: "sess", user: { id: "u1" } });
    M.mint.mockResolvedValue({ status: "unavailable", token: null });
    expect((await (await post("login", { email: "a@b.c", password: "pw" })).json()).data.token).toBeNull();
  });
  it("forwards the body device string to sign-in, else the request user-agent", async () => {
    M.signIn.mockResolvedValue({ ok: true, session: "sess", user: { id: "u1" } });
    M.mint.mockResolvedValue({ status: "active", token: "jwt" });
    const { default: app } = await import("../index");

    // Body `device` wins.
    await app.request(
      "/api/v1/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "okhttp/4.12.0" },
        body: JSON.stringify({ email: "a@b.c", password: "pw", device: "DistributionOS/1.1.2 (Android 13; samsung; SM-G991B)" }),
      },
      ENV,
    );
    expect(M.signIn).toHaveBeenLastCalledWith(
      expect.anything(),
      "a@b.c",
      "pw",
      "DistributionOS/1.1.2 (Android 13; samsung; SM-G991B)",
    );

    // No body device → falls back to the request user-agent.
    await app.request(
      "/api/v1/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "okhttp/4.12.0" },
        body: JSON.stringify({ email: "a@b.c", password: "pw" }),
      },
      ENV,
    );
    expect(M.signIn).toHaveBeenLastCalledWith(expect.anything(), "a@b.c", "pw", "okhttp/4.12.0");
  });
  it("login 401s bad credentials and 503s an upstream outage", async () => {
    M.signIn.mockResolvedValue({ ok: false, status: 401, error: "bad" });
    expect((await post("login", { email: "a@b.c", password: "pw" })).status).toBe(401);
    M.signIn.mockResolvedValue({ ok: false, status: 502, error: "down" });
    expect((await post("login", { email: "a@b.c", password: "pw" })).status).toBe(503);
  });
  it("token mints from a stored session", async () => {
    M.mint.mockResolvedValue({ status: "active", token: "jwt" });
    expect((await post("token", { session: "sess" })).status).toBe(200);
  });
  it("sign-out is best-effort ok", async () => {
    M.signOut.mockResolvedValue(undefined);
    expect((await (await post("sign-out", { session: "sess" })).json()).data.ok).toBe(true);
  });
});
