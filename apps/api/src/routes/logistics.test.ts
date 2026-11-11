import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

const paged = { rows: [], total: 0, page: 1, pageSize: 20 };
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/logistics", () => ({
  listDeliveryCustomers: vi.fn().mockResolvedValue(paged),
  listDeliveryStops: vi.fn().mockResolvedValue(paged),
  getCustomerDeliveryDetail: vi.fn().mockResolvedValue({ customer: {}, deliveries: [] }),
  getDeliveryPhotoStream: vi.fn().mockResolvedValue({ body: new Uint8Array([1]), contentType: "image/jpeg" }),
}));
vi.mock("../services/logistics-runs", () => ({ listDeliveryRuns: vi.fn().mockResolvedValue(paged) }));
vi.mock("../services/logistics-run-detail", () => ({ getRunDetail: vi.fn().mockResolvedValue({ run: {} }) }));
vi.mock("../services/logistics-runs-summary", () => ({ getRunsSummary: vi.fn().mockResolvedValue({ runs: 0 }) }));

const envBucket = { ...ENV, PHOTOS: { get: vi.fn() } };
beforeEach(() => { vi.resetModules(); installAuth(); });
const get = async (p: string, env: unknown = ENV) => {
  const { default: app } = await import("../index");
  return app.request(`/api/v1/logistics${p}`, { headers: headers("superAdmin") }, env as never);
};

describe("logistics routes (office read views)", () => {
  it("GET /customers, /deliveries, /runs, /runs-summary", async () => {
    expect((await get("/customers?q=a&from=2026-06-01&to=2026-06-30&sort=name&dir=asc&page=1&pageSize=20")).status).toBe(200);
    expect((await get("/deliveries")).status).toBe(200);
    expect((await get("/runs")).status).toBe(200);
    expect((await get("/runs-summary")).status).toBe(200);
  });
  it("GET /runs/:id and /customers/:id detail", async () => {
    expect((await get("/runs/r1")).status).toBe(200);
    expect((await get("/customers/c1")).status).toBe(200);
  });
  it("GET /photos/:id streams with a bucket, 500s without one", async () => {
    const ok = await get("/photos/ph1", envBucket);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Content-Type")).toBe("image/jpeg");
    expect((await get("/photos/ph1")).status).toBe(500);
  });
  it("403s a non-office role", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/logistics/runs", { headers: headers("se") }, ENV)).status).toBe(403);
  });
});
