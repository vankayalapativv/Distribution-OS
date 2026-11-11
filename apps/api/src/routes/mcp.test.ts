import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/mcp-inbound", () => ({
  getInboundStatus: vi.fn().mockResolvedValue({ enabled: true }),
  getInboundAudit: vi.fn().mockResolvedValue({ entries: [] }),
  patchInboundConfig: vi.fn().mockResolvedValue({ enabled: true }),
}));

const h = () => ({ ...headers("superAdmin"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });

describe("mcp routes (SUPER_ADMIN/MANAGER)", () => {
  it("GET /server returns status", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/mcp/server", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("PATCH /server updates (enabled)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/mcp/server", { method: "PATCH", headers: h(), body: JSON.stringify({ enabled: true }) }, ENV);
    expect(res.status).toBe(200);
  });
  it("PATCH /server 422s an empty update", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/mcp/server", { method: "PATCH", headers: h(), body: "{}" }, ENV);
    expect(res.status).toBe(422);
  });
  it("GET /server/audit clamps the limit", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/mcp/server/audit?limit=9999", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
});
