import { describe, expect, it, vi, beforeEach } from "vitest";

const neonJwtFromSession = vi.fn();
const serverApiFetch = vi.fn();

vi.mock("../../../../lib/neon-auth-server", () => ({
  neonJwtFromSession: (...a: unknown[]) => neonJwtFromSession(...a),
}));
vi.mock("../../../../lib/server-api", () => ({
  serverApiFetch: (...a: unknown[]) => serverApiFetch(...a),
}));

import { POST } from "./route";

function req(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
}

function meOk(role: string) {
  return { ok: true, json: async () => ({ data: { auth: { role } } }) } as Response;
}

/** Route both API calls: /auth/login → a session, /me → the given role. A custom
 *  `login` Response overrides the sign-in (e.g. a failure). */
function mockApi({ role = "MANAGER", session = "sess", login }: { role?: string; session?: string; login?: Response } = {}) {
  serverApiFetch.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/auth/login"
        ? (login ?? ({ ok: true, json: async () => ({ data: { session } }) } as Response))
        : path === "/me"
          ? meOk(role)
          : ({ ok: true, json: async () => ({ data: {} }) } as Response),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  neonJwtFromSession.mockResolvedValue("jwt");
});

describe("POST /api/auth/login", () => {
  it("rejects a SALES_EXECUTIVE with no web access and sets no session cookie", async () => {
    mockApi({ role: "SALES_EXECUTIVE" });
    const res = await POST(req({ email: "se@x.com", password: "pw" }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/does not have web access/i);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("sa_session=");
  });

  it("rejects LOGISTICS too", async () => {
    mockApi({ role: "LOGISTICS" });
    const res = await POST(req({ email: "log@x.com", password: "pw" }));
    expect(res.status).toBe(403);
  });

  it("lets a web role (MANAGER) in and sets the session cookie", async () => {
    mockApi({ role: "MANAGER", session: "sess" });
    const res = await POST(req({ email: "m@x.com", password: "pw" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; role?: string };
    expect(body.ok).toBe(true);
    expect(body.role).toBe("MANAGER");
    expect(res.headers.get("set-cookie") ?? "").toContain("sa_session=sess");
  });

  it("signs both email and phone in via the API (one path) and sets the session", async () => {
    mockApi({ role: "ACCOUNTANT", session: "sess-phone" });
    const res = await POST(req({ identifier: "9985294475", password: "pw" }));
    expect(res.status).toBe(200);
    // The first API call is the sign-in, carrying the raw identifier (email or phone).
    const loginCall = serverApiFetch.mock.calls.find(([p]) => p === "/auth/login");
    expect(loginCall).toBeTruthy();
    expect(JSON.parse((loginCall![1] as RequestInit).body as string).identifier).toBe("9985294475");
    expect(res.headers.get("set-cookie") ?? "").toContain("sa_session=sess-phone");
  });

  it("rejects bad credentials with a generic 401 before any role check", async () => {
    mockApi({
      login: { ok: false, json: async () => ({ error: { code: "UNAUTHORIZED", message: "bad" } }) } as Response,
    });
    const res = await POST(req({ email: "x@x.com", password: "bad" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/invalid email\/phone or password/i);
    // No role/JWT resolution happens without a session.
    expect(neonJwtFromSession).not.toHaveBeenCalled();
  });

  it("surfaces a deactivated account as 403 with the clear message (email OR phone)", async () => {
    mockApi({
      login: {
        ok: false,
        json: async () => ({
          error: { code: "ACCOUNT_INACTIVE", message: "Your account has been deactivated. Please contact your administrator." },
        }),
      } as Response,
    });
    const res = await POST(req({ email: "gone@x.com", password: "pw" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/deactivated/i);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("sa_session=");
    expect(neonJwtFromSession).not.toHaveBeenCalled();
  });

  it("forwards the browser User-Agent to the sign-in so the session records the real device", async () => {
    mockApi({ role: "MANAGER" });
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36";
    await POST(req({ email: "m@x.com", password: "pw" }, { "User-Agent": ua }));
    const loginCall = serverApiFetch.mock.calls.find(([p]) => p === "/auth/login");
    expect(loginCall).toBeTruthy();
    const init = loginCall![1] as RequestInit;
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(ua);
    expect(JSON.parse(init.body as string).device).toBe(ua);
  });
});
