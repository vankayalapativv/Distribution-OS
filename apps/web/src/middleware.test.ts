import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("NEON_AUTH_BASE_URL", "https://neon.test");
const { middleware } = await import("./middleware");

function reqWith(cookies: Record<string, string>) {
  const req = new NextRequest("http://localhost:3000/customers");
  for (const [k, v] of Object.entries(cookies)) req.cookies.set(k, v);
  return req;
}

beforeEach(() => vi.restoreAllMocks());

describe("auth-revocation middleware", () => {
  it("passes a still-valid session straight through", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const res = await middleware(reqWith({ sa_session: "good" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects a revoked session to the logout route", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    const res = await middleware(reqWith({ sa_session: "revoked" }));
    expect(res.headers.get("location")).toContain("/api/auth/logout");
  });

  it("fails open on a network error (never locks anyone out)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("neon down"));
    const res = await middleware(reqWith({ sa_session: "x" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not validate when a legacy cookie is present, or no session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    expect((await middleware(reqWith({ sa_session: "x", sri_aparajita_auth: "legacy" }))).headers.get("location")).toBeNull();
    expect((await middleware(reqWith({}))).headers.get("location")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
