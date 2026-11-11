import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/stock-locations", () => ({
  listLocations: vi.fn().mockResolvedValue([]),
  createLocation: vi.fn().mockResolvedValue({ id: "l1", name: "Main" }),
  renameLocation: vi.fn().mockResolvedValue({ id: "l1", name: "Main2" }),
  updateLocation: vi.fn().mockResolvedValue({ id: "l1", name: "Main" }),
}));
vi.mock("../services/stock", () => ({
  balancesByGodown: vi.fn().mockResolvedValue([{ locationId: "l1", locationName: "Main", skuCount: 1, units: 2, litres: 10 }]),
  balancesSummary: vi.fn().mockResolvedValue({ skus: 0 }),
  getAdjustment: vi.fn().mockResolvedValue({ id: "a1" }),
  getBalancesForSkus: vi.fn().mockResolvedValue(new Map([["p1|5", 3]])),
  getGrn: vi.fn().mockResolvedValue({ id: "g1" }),
  getTransfer: vi.fn().mockResolvedValue({ id: "t1" }),
  getInvoiceStockLots: vi.fn().mockResolvedValue({ kind: "sale", invoiceNumber: "SA/1", lines: [] }),
  listAdjustments: vi.fn().mockResolvedValue({ rows: [] }),
  listAvailableLots: vi.fn().mockResolvedValue([{ id: "lot-1", batchNumber: "B1", expiryDate: "2027-01-10", qtyUnits: 50, daysToExpiry: 60 }]),
  listInvoiceStockActivity: vi.fn().mockResolvedValue([{ invoiceId: "inv-1", kind: "sale", invoiceNumber: "SA/1", units: 25, lineCount: 1, value: 17700 }]),
  listBalances: vi.fn().mockResolvedValue({ rows: [] }),
  listGrns: vi.fn().mockResolvedValue({ rows: [] }),
  listMovements: vi.fn().mockResolvedValue({ rows: [] }),
  listNearExpiry: vi.fn().mockResolvedValue([]),
  listSkus: vi.fn().mockResolvedValue([]),
  listTransfers: vi.fn().mockResolvedValue({ rows: [] }),
  lookupProductStock: vi.fn().mockResolvedValue({ product: { id: "p1" }, balances: [], totals: { qtyUnits: 0, litres: 0 }, batches: [], movements: [] }),
  postAdjustment: vi.fn().mockResolvedValue({ id: "a1", adjustmentNumber: "ADJ-1" }),
  postGrn: vi.fn().mockResolvedValue({ id: "g1", grnNumber: "GRN-1" }),
  postOpening: vi.fn().mockResolvedValue({ ok: true }),
  postTransfer: vi.fn().mockResolvedValue({ id: "t1", transferNumber: "TRF-1" }),
  recomputeBalances: vi.fn().mockResolvedValue({ rebuilt: 0 }),
  setReorderLevel: vi.fn().mockResolvedValue(undefined),
}));

const jh = (r: Parameters<typeof headers>[0] = "superAdmin") => ({ ...headers(r), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
// Stock Journal is section-guarded (section:stock, default off for MANAGER/
// ACCOUNTANT); SUPER_ADMIN bypasses the guard, so reads run as SA here.
const get = async (p: string, r: Parameters<typeof headers>[0] = "superAdmin") => (await (await app()).request(`/api/v1/stock${p}`, { headers: headers(r) }, ENV));
const post = async (p: string, b: unknown, m = "POST", r: Parameters<typeof headers>[0] = "superAdmin") => (await (await app()).request(`/api/v1/stock${p}`, { method: m, headers: jh(r), body: JSON.stringify(b) }, ENV));

const goodLine = { productId: "p1", packSizeLitres: 5, brand: "Fuchs", qtyUnits: 10, rate: 100 };
const badLine = { productId: "", packSizeLitres: 0, qtyUnits: 1 };

describe("stock routes — reads", () => {
  it("locations / skus / balances / summary / movements / lists / details", async () => {
    expect((await get("/locations?activeOnly=1")).status).toBe(200);
    expect((await get("/skus?search=oil&brand=Fuchs")).status).toBe(200);
    expect((await get("/balances?locationId=l1&search=x&lowOnly=1&page=1&pageSize=20")).status).toBe(200);
    expect((await get("/balances/summary?locationId=l1")).status).toBe(200);
    expect((await get("/movements?locationId=l1&productId=p1&kind=grn&page=1&pageSize=20")).status).toBe(200);
    for (const p of ["/grn", "/transfers", "/adjustments"]) expect((await get(p + "?locationId=l1&page=1&pageSize=5")).status).toBe(200);
    for (const p of ["/grn/g1", "/transfers/t1", "/adjustments/a1"]) expect((await get(p)).status).toBe(200);
  });
  it("balances/for-skus — 422 without godown, 200 with mixed sku list", async () => {
    expect((await get("/balances/for-skus")).status).toBe(422);
    const res = await get("/balances/for-skus?locationId=l1&skus=p1:5,bad:,p2:0,p3:2");
    expect(res.status).toBe(200);
    expect((await res.json()).data.balances[0].qtyUnits).toBe(3);
  });
  it("near-expiry — with and without filters", async () => {
    expect((await get("/near-expiry?locationId=l1&withinDays=30")).status).toBe(200);
    expect((await get("/near-expiry")).status).toBe(200);
  });
  it("summary/by-godown — returns the per-godown breakdown", async () => {
    const res = await get("/summary/by-godown");
    expect(res.status).toBe(200);
    expect((await res.json()).data.rows[0].litres).toBe(10);
  });
  it("lookup — 422 without productId, 200 with one", async () => {
    expect((await get("/lookup")).status).toBe(422);
    const res = await get("/lookup?productId=p1");
    expect(res.status).toBe(200);
    expect((await res.json()).data.lookup.product.id).toBe("p1");
  });
  it("lots — 422 without locationId/productId, 200 with both", async () => {
    expect((await get("/lots")).status).toBe(422);
    expect((await get("/lots?locationId=l1")).status).toBe(422);
    const res = await get("/lots?locationId=l1&productId=p1&packSizeLitres=5");
    expect(res.status).toBe(200);
    expect((await res.json()).data.lots[0].id).toBe("lot-1");
  });
  it("invoice-activity — sale/reversal rows (with and without a godown)", async () => {
    expect((await get("/invoice-activity")).status).toBe(200);
    const res = await get("/invoice-activity?locationId=l1&limit=20");
    expect(res.status).toBe(200);
    expect((await res.json()).data.rows[0].invoiceId).toBe("inv-1");
  });
  it("invoice-lots — 422 without invoiceId, 200 for sale and reversal", async () => {
    expect((await get("/invoice-lots")).status).toBe(422);
    expect((await get("/invoice-lots?invoiceId=inv-1&kind=reversal")).status).toBe(200);
    const res = await get("/invoice-lots?invoiceId=inv-1&kind=sale");
    expect(res.status).toBe(200);
    expect((await res.json()).data.detail.invoiceNumber).toBe("SA/1");
  });
});

describe("stock routes — writes", () => {
  it("create / rename / update location", async () => {
    expect((await post("/locations", { name: "Main", code: "M", city: "Hyd", state: "TS", stateCode: "36", pincode: "500001", isDefault: true })).status).toBe(201);
    expect((await post("/locations/l1/rename", { name: "Main2" }, "PATCH")).status).toBe(200);
    expect((await post("/locations/l1", { name: "Main", isDefault: false }, "PATCH")).status).toBe(200);
  });
  it("post grn / transfer / adjustment / opening (mixed valid+dropped lines)", async () => {
    expect((await post("/grn", { locationId: "l1", supplierName: "ACME", lines: [{ ...goodLine, rate: 90 }, badLine] })).status).toBe(201);
    expect((await post("/transfers", { fromLocationId: "l1", toLocationId: "l2", lines: [goodLine, badLine] })).status).toBe(201);
    expect((await post("/adjustments", { locationId: "l1", reason: "damage", lines: [{ productId: "p1", packSizeLitres: 5, deltaUnits: -2 }, badLine] })).status).toBe(201);
    expect((await post("/opening", { locationId: "l1", lines: [goodLine] })).status).toBe(201);
  });
  it("opening — parses batch/expiry/location detail and drops zero-qty lines", async () => {
    const res = await post("/opening", { locationId: "l1", openingDate: "2026-04-01", lines: [
      { ...goodLine, batchNumber: "B1", expiryDate: "2027-01-01", rackNo: "R1", shelfNo: "S1", binNo: "BN1" },
      { productId: "p2", packSizeLitres: 1, qtyUnits: 0 },
      { packSizeLitres: 5, qtyUnits: 2 },
    ] });
    expect(res.status).toBe(201);
  });
  it("reorder — 422 on negative, ok on valid and on null-clear", async () => {
    expect((await post("/reorder", { locationId: "l1", productId: "p1", packSizeLitres: 5, reorderLevel: -1 }, "PUT")).status).toBe(422);
    expect((await post("/reorder", { locationId: "l1", productId: "p1", packSizeLitres: 5, reorderLevel: 5 }, "PUT")).status).toBe(200);
    expect((await post("/reorder", { locationId: "l1", productId: "p1", packSizeLitres: 5 }, "PUT")).status).toBe(200);
  });
  it("recompute (SUPER_ADMIN)", async () => {
    expect((await post("/recompute", {}, "POST")).status).toBe(200);
  });
});

describe("stock routes — section guard", () => {
  it("403s MANAGER and ACCOUNTANT by default (section:stock off)", async () => {
    expect((await get("/locations", "manager")).status).toBe(403);
    expect((await get("/balances", "accountant")).status).toBe(403);
  });
});
