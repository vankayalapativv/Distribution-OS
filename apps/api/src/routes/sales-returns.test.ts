import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
const sr = { id: "sr1", invoiceNumber: "INV-1", grossAmount: 500, itemCount: 1 };
vi.mock("../services/sales-returns", () => ({
  createSalesReturn: vi.fn().mockResolvedValue(sr),
  updateSalesReturn: vi.fn().mockResolvedValue({ ...sr, itemCount: 2 }),
  getSalesReturnForEdit: vi.fn().mockResolvedValue({ header: {}, lines: [] }),
  getSalesReturnProof: vi.fn().mockResolvedValue({ body: new Uint8Array([1]), contentType: "image/jpeg" }),
}));

const envBucket = { ...ENV, PHOTOS: { get: vi.fn(), put: vi.fn() } };
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
const fd = (fields: Record<string, string>, file?: File) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  if (file) f.append("file", file);
  return f;
};
const req = async (p: string, method: string, body: FormData, r: Parameters<typeof headers>[0] = "superAdmin", env: unknown = ENV) => {
  // Drop the harness's JSON Content-Type so undici sets the multipart boundary.
  const h = { ...headers(r) } as Record<string, string>;
  delete h["Content-Type"];
  const request = new Request(`http://local/api/v1/sales-returns${p}`, { method, headers: h, body });
  return (await app()).request(request, undefined, env as never);
};

describe("sales-returns routes", () => {
  it("POST / — 422 missing ids", async () => {
    expect((await req("", "POST", fd({ customerId: "", invoiceId: "" }))).status).toBe(422);
  });
  it("POST / — 422 on bad items JSON", async () => {
    expect((await req("", "POST", fd({ customerId: "c1", invoiceId: "i1", items: "not-json" }))).status).toBe(422);
  });
  it("POST / — 422 when proof exceeds 10 MB", async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    expect((await req("", "POST", fd({ customerId: "c1", invoiceId: "i1" }, big), "superAdmin", envBucket)).status).toBe(422);
  });
  it("POST / — 201 with items + a small proof (needs bucket)", async () => {
    const small = new File([new Uint8Array([1, 2, 3])], "p.jpg", { type: "image/jpeg" });
    const res = await req("", "POST", fd({ customerId: "c1", invoiceId: "i1", returnDate: "2026-06-10", reason: "damaged", items: JSON.stringify([{ orderItemId: "oi1", qtyUnits: 1 }]) }, small), "accountant", envBucket);
    expect(res.status).toBe(201);
  });
  it("GET /:id edit detail", async () => {
    expect((await (await app()).request("/api/v1/sales-returns/sr1", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("PATCH /:id — 422 bad items, 200 ok", async () => {
    expect((await req("/sr1", "PATCH", fd({ items: "nope" }))).status).toBe(422);
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    expect((await req("/sr1", "PATCH", fd({ reason: "x" }, big), "superAdmin", envBucket)).status).toBe(422);
    expect((await req("/sr1", "PATCH", fd({ returnDate: "2026-06-10", reason: "x", items: JSON.stringify([]) }))).status).toBe(200);
  });
  it("GET /:id/proof — 500 without bucket, 200 with", async () => {
    expect((await (await app()).request("/api/v1/sales-returns/sr1/proof", { headers: headers("superAdmin") }, ENV)).status).toBe(500);
    const ok = await (await app()).request("/api/v1/sales-returns/sr1/proof", { headers: headers("superAdmin") }, envBucket);
    expect(ok.status).toBe(200);
  });
});
