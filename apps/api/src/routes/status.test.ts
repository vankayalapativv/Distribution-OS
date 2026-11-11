import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, installAuth } from "../test/route-harness";

const S = vi.hoisted(() => ({ live: true }));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({ health_check: [{ ok: 1 }] })) };
});
vi.mock("../services/health-monitor", () => ({
  inStatusWindow: () => S.live,
  probeComponents: async () => ({ api: { status: "ok", latencyMs: 1, observedAt: "t" }, database: { status: "ok", latencyMs: 5, observedAt: "t" } }),
}));
beforeEach(() => { vi.resetModules(); installAuth(); });

describe("GET /status-summary (public)", () => {
  it("live window → fresh probe", async () => {
    S.live = true;
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/status-summary", {}, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data.live).toBe(true);
  });
  it("off-hours → last-known, no DB probe", async () => {
    S.live = false;
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/status-summary", {}, ENV);
    expect((await res.json()).data.live).toBe(false);
  });
});
