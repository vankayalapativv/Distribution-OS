import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/dashboard", () => ({
  getAccountantDashboard: vi.fn().mockResolvedValue({ a: 1 }),
  getManagerDashboard: vi.fn().mockResolvedValue({ m: 1 }),
  getSuperAdminDashboard: vi.fn().mockResolvedValue({ s: 1 }),
}));
vi.mock("../services/dashboard-map", () => ({
  getDashboardMapCustomers: vi.fn().mockResolvedValue({ customers: [], bands: [] }),
  getDashboardMapActivity: vi.fn().mockResolvedValue({ points: [] }),
}));
vi.mock("../services/sku-analytics", () => ({ getSkuAnalytics: vi.fn().mockResolvedValue({ skus: [] }) }));
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("dashboard map/sku/role pages", () => {
  it("map, map/activity, sku-analytics (SUPER_ADMIN/MANAGER)", async () => {
    expect((await (await app()).request("/api/v1/dashboard/map", { headers: headers("manager") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/dashboard/map/activity", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/dashboard/sku-analytics?from=2026-06-01&to=2026-06-30", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("super-admin dashboard page", async () => {
    expect((await (await app()).request("/api/v1/dashboard/super-admin", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
});
