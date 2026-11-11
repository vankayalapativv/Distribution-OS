import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, installAuth } from "../test/route-harness";

const H = vi.hoisted(() => ({ responses: {} as Record<string, unknown[]> }));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => H.responses) };
});
beforeEach(() => { vi.resetModules(); H.responses = { health_check: [{ ok: 1 }] }; installAuth(); });

describe("GET /health", () => {
  it("200 when the DB probe is ok", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/health", {}, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("ok");
  });
  it("503 when the DB is not configured (down)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/health", {}, { ...ENV, DATABASE_URL: "" });
    expect(res.status).toBe(503);
  });
});
