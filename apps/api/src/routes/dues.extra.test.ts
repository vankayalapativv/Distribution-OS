import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/dues", () => ({
  getAdminDuesSummary: vi.fn().mockResolvedValue({ buckets: [], totalCustomers: 0 }),
  getDuesByExecutive: vi.fn().mockResolvedValue([]),
  listAdminDuesCustomers: vi.fn().mockResolvedValue([]),
  getMyDuesSummary: vi.fn().mockResolvedValue({ buckets: [] }),
  listMyDuesCustomers: vi.fn().mockResolvedValue([]),
}));
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("dues admin routes", () => {
  it("summary / by-executive / customers (SUPER_ADMIN)", async () => {
    expect((await (await app()).request("/api/v1/dues/summary?executiveId=se-1&city=Hyd", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/dues/by-executive", { headers: headers("manager") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/dues/customers?bucket=60_plus&executiveId=se-1&city=Hyd", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
});
