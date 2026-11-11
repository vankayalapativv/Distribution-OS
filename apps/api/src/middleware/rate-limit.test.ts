import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { rateLimit, type RateLimitBinding } from "./rate-limit";
import { attachRequestContext } from "./request-context";
import type { ApiEnv } from "../types";

/** A tiny app that rate-limits POST /auth/login and echoes OK past the gate. */
function appWith(binding: RateLimitBinding | undefined) {
  const app = new Hono<ApiEnv>();
  app.use("*", attachRequestContext);
  app.use("/auth/login", rateLimit("RL_LOGIN", "login"));
  app.post("/auth/login", (c) => c.json({ ok: true }));
  const env = { RL_LOGIN: binding } as unknown as ApiEnv["Bindings"];
  return (headers: Record<string, string> = {}) =>
    app.request("/auth/login", { method: "POST", headers }, env);
}

describe("rateLimit middleware", () => {
  it("passes through when the binding is absent (local dev / tests)", async () => {
    const res = await appWith(undefined)();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("passes through when the limiter allows the request", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const res = await appWith({ limit })({ "cf-connecting-ip": "1.2.3.4" });
    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith({ key: "login:1.2.3.4" });
  });

  it("returns 429 + Retry-After and does NOT run the handler when throttled", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await appWith({ limit })({ "cf-connecting-ip": "9.9.9.9" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(limit).toHaveBeenCalledWith({ key: "login:9.9.9.9" });
  });

  it("keys by the first x-forwarded-for hop when CF header is absent", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    await appWith({ limit })({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" });
    expect(limit).toHaveBeenCalledWith({ key: "login:5.6.7.8" });
  });

  it("falls back to an 'unknown' key when no IP header is present", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    await appWith({ limit })();
    expect(limit).toHaveBeenCalledWith({ key: "login:unknown" });
  });
});
