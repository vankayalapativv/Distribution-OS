import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/incentives", () => ({
  listIncentives: vi.fn().mockResolvedValue({ rows: [] }),
  upsertIncentive: vi.fn().mockResolvedValue(undefined),
}));

const h = () => ({ ...headers("accountant"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });

describe("incentives routes", () => {
  it("GET / lists for a month", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/incentives?month=2026-06", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("PUT /:userId sets the knobs", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/incentives/se-1", { method: "PUT", headers: h(), body: JSON.stringify({ month: "2026-06", collectionPct: 2, perLitreRate: 1 }) }, ENV);
    expect(res.status).toBe(200);
  });
});
