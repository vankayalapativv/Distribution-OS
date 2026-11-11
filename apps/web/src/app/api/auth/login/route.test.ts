import { describe, expect, it, vi, beforeEach } from "vitest";

const neonSignIn = vi.fn();
const neonJwtFromSession = vi.fn();
const serverApiFetch = vi.fn();

vi.mock("../../../../lib/neon-auth-server", () => ({
  neonSignIn: (...a: unknown[]) => neonSignIn(...a),
  neonJwtFromSession: (...a: unknown[]) => neonJwtFromSession(...a),
}));
vi.mock("../../../../lib/server-api", () => ({
  serverApiFetch: (...a: unknown[]) => serverApiFetch(...a),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function meOk(role: string) {
  return { ok: true, json: async () => ({ data: { auth: { role } } }) } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  neonSignIn.mockResolvedValue({ ok: true, session: "sess" });
  neonJwtFromSession.mockResolvedValue("jwt");
});

describe("POST /api/auth/login", () => {
  it("rejects a SALES_EXECUTIVE with no web access and sets no session cookie", async () => {
    serverApiFetch.mockResolvedValue(meOk("SALES_EXECUTIVE"));
    const res = await POST(req({ email: "se@x.com", password: "pw" }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/does not have web access/i);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("sa_session=");
  });

  it("rejects LOGISTICS too", async () => {
    serverApiFetch.mockResolvedValue(meOk("LOGISTICS"));
    const res = await POST(req({ email: "log@x.com", password: "pw" }));
    expect(res.status).toBe(403);
  });

  it("lets a web role (MANAGER) in and sets the session cookie", async () => {
    serverApiFetch.mockResolvedValue(meOk("MANAGER"));
    const res = await POST(req({ email: "m@x.com", password: "pw" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; role?: string };
    expect(body.ok).toBe(true);
    expect(body.role).toBe("MANAGER");
    expect(res.headers.get("set-cookie") ?? "").toContain("sa_session=sess");
  });

  it("signs a phone identifier in via the API (not direct Neon) and sets its session", async () => {
    serverApiFetch.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/auth/login"
          ? ({ ok: true, json: async () => ({ data: { session: "sess-phone" } }) } as Response)
          : meOk("ACCOUNTANT"),
      ),
    );
    const res = await POST(req({ identifier: "9985294475", password: "pw" }));
    expect(res.status).toBe(200);
    expect(neonSignIn).not.toHaveBeenCalled(); // phone goes through the API, not direct Neon
    expect(res.headers.get("set-cookie") ?? "").toContain("sa_session=sess-phone");
  });

  it("rejects bad credentials before any role check", async () => {
    neonSignIn.mockResolvedValue({ ok: false, session: null, error: "Invalid email or password." });
    const res = await POST(req({ email: "x@x.com", password: "bad" }));
    expect(res.status).toBe(401);
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("forwards the browser User-Agent to the sign-in so the session records the real device", async () => {
    serverApiFetch.mockResolvedValue(meOk("MANAGER"));
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36";
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": ua },
      body: JSON.stringify({ email: "m@x.com", password: "pw" }),
    });
    await POST(request);
    expect(neonSignIn).toHaveBeenCalledWith("m@x.com", "pw", ua);
  });
});
