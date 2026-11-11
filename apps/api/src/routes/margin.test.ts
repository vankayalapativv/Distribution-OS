import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/margin", () => ({
  listMarginSimulations: vi.fn().mockResolvedValue([]),
  createMarginSimulation: vi.fn().mockResolvedValue({ id: "m1", productName: "X10" }),
  updateMarginSimulation: vi.fn().mockResolvedValue({ id: "m1", productName: "X10" }),
  deleteMarginSimulation: vi.fn().mockResolvedValue(undefined),
}));

const h = () => ({ ...headers("superAdmin"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });

describe("margin-simulations routes (SUPER_ADMIN)", () => {
  it("GET / lists", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/margin-simulations", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
  it("POST / creates (minimal body exercises numeric fallbacks)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/margin-simulations", { method: "POST", headers: h(), body: JSON.stringify({ productName: "X10" }) }, ENV);
    expect(res.status).toBe(201);
  });
  it("PATCH /:id updates", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/margin-simulations/m1", { method: "PATCH", headers: h(), body: JSON.stringify({ productName: "X10", mrp: 100, coupon: 2 }) }, ENV);
    expect(res.status).toBe(200);
  });
  it("DELETE /:id deletes", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/margin-simulations/m1", { method: "DELETE", headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
});
