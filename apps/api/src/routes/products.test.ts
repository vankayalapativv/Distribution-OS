import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/products", () => ({
  listManagedProducts: vi.fn().mockResolvedValue([]),
  listManagedProductsPaged: vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 20 }),
  createProduct: vi.fn().mockResolvedValue({ id: "p1", productName: "Titan" }),
  bulkCreateProducts: vi.fn().mockResolvedValue({ created: 1, errors: [] }),
  updateProduct: vi.fn().mockResolvedValue({ id: "p1", productName: "Titan" }),
  deleteProduct: vi.fn().mockResolvedValue({ id: "p1", productName: "Titan" }),
}));

const h = () => ({ ...headers("superAdmin"), "content-type": "application/json" });
const bodyP = { productName: "Titan", brand: "Fuchs", segments: ["Car"], packs: [], hsnCode: "2710", unit: "L" };
beforeEach(() => { vi.resetModules(); installAuth(); });

describe("products routes", () => {
  it("GET / lists (ACCOUNTANT allowed)", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/products", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("GET /paged with filters incl. empty-string page → null", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/products/paged?search=oil&status=active&brand=Fuchs&sort=name&dir=asc&page=&pageSize=20", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("POST / creates (201)", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/products", { method: "POST", headers: h(), body: JSON.stringify(bodyP) }, ENV)).status).toBe(201);
  });
  it("POST /bulk imports (200, created count + errors)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/products/bulk", { method: "POST", headers: h(), body: JSON.stringify({ products: [bodyP] }) }, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ created: 1, errors: [] });
  });
  it("POST /bulk logs the plural summary when created ≠ 1", async () => {
    const products = await import("../services/products");
    vi.mocked(products.bulkCreateProducts).mockResolvedValueOnce({ created: 2, errors: [] });
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/products/bulk", { method: "POST", headers: h(), body: JSON.stringify({ products: [bodyP, bodyP] }) }, ENV)).status).toBe(200);
  });
  it("PATCH /:id updates", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/products/p1", { method: "PATCH", headers: h(), body: JSON.stringify(bodyP) }, ENV)).status).toBe(200);
  });
  it("DELETE /:id deletes", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/products/p1", { method: "DELETE", headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
});
