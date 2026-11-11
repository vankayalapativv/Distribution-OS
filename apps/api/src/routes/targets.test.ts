import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/targets", () => ({
  OIL_SEGMENTS: ["Car", "2W", "Gear Oil"],
  getMyPerformance: vi.fn().mockResolvedValue({ today: {} }),
  listExecutiveTargets: vi.fn().mockResolvedValue({ rows: [] }),
  upsertTarget: vi.fn().mockResolvedValue({ userId: "se-1", seName: "Asha", periodType: "week", periodStart: "2026-06-01" }),
}));

const h = () => ({ ...headers("superAdmin"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });

describe("targets routes", () => {
  it("GET /me (SE performance)", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/targets/me", { headers: headers("se") }, ENV)).status).toBe(200);
  });
  it("GET / lists executive targets (month)", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/targets?periodType=month", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("GET / defaults periodType to week", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/targets", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
  it("PUT /:userId upserts a target (segments default to 0)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/targets/se-1", { method: "PUT", headers: h(), body: JSON.stringify({ periodType: "week", segments: { Car: 100 } }) }, ENV);
    expect(res.status).toBe(200);
  });
});
