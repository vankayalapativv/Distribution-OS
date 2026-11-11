import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../lib/wait-until", () => ({ waitUntilSafe: vi.fn() }));
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/invoices", () => ({
  getInvoice: vi.fn().mockResolvedValue({ id: "i1" }),
  listInvoices: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  sendExpoPush: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/sales-returns", () => ({ getReturnableInvoice: vi.fn().mockResolvedValue({ lines: [] }) }));
const genInvoice = { id: "i1", invoiceNumber: "INV-1", customerName: "Ravi", grandTotal: 1000, push: { tokens: ["t"], title: "T", body: "B" } };
vi.mock("../services/invoicing", () => ({
  generateInvoice: vi.fn().mockResolvedValue(genInvoice),
  editGeneratedInvoice: vi.fn().mockResolvedValue(genInvoice),
  cancelInvoice: vi.fn().mockResolvedValue({ id: "i1", invoiceNumber: "INV-1" }),
  getGeneratedInvoiceForEdit: vi.fn().mockResolvedValue({ header: {}, lines: [] }),
  getInvoiceItems: vi.fn().mockResolvedValue([]),
  getInvoicePdfBytes: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), fileName: "INV-1.pdf" }),
  getInvoicePdfData: vi.fn().mockResolvedValue({ invoice: {} }),
  getNextInvoiceNumberPreview: vi.fn().mockResolvedValue({ next: "INV-2" }),
}));
vi.mock("../services/invoice-gst-export", () => ({ getInvoiceExport: vi.fn().mockResolvedValue({ rows: [] }) }));

const jh = (r: Parameters<typeof headers>[0] = "superAdmin") => ({ ...headers(r), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);

const lineBody = {
  customerId: "c1", locationId: "l1", invoiceDate: "2026-06-10",
  orderId: "o1", placeOfSupply: "TS", reverseCharge: "true",
  lines: [
    { productId: "p1", packSizeLitres: 5, brand: "Fuchs", segment: "Car", hsnCode: "2710", qtyUnits: 2, rate: 100, mrp: 120, discountPct: 5, orderItemId: "oi1" },
    { productId: "", packSizeLitres: 0, qtyUnits: 0, mrp: "" },
  ],
};

describe("invoices routes", () => {
  it("GET / list, /export, /next-number", async () => {
    expect((await (await app()).request("/api/v1/invoices?q=INV&customerId=c1&sort=date&dir=desc&page=1&pageSize=10", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/invoices/export?from=2026-06-01&to=2026-06-30", { headers: headers("accountant") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/invoices/next-number", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("GET /:id, /:id/pdf-data, /:id/returnable", async () => {
    expect((await (await app()).request("/api/v1/invoices/i1", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/invoices/i1/pdf-data", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/invoices/i1/returnable", { headers: headers("superAdmin") }, ENV)).status).toBe(200);
  });
  it("POST /generate (201)", async () => {
    expect((await (await app()).request("/api/v1/invoices/generate", { method: "POST", headers: jh(), body: JSON.stringify(lineBody) }, ENV)).status).toBe(201);
  });
  it("GET /:id/edit-data, PATCH /:id/generated, POST /:id/cancel", async () => {
    expect((await (await app()).request("/api/v1/invoices/i1/edit-data", { headers: headers("accountant") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/invoices/i1/generated", { method: "PATCH", headers: jh(), body: JSON.stringify(lineBody) }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/invoices/i1/cancel", { method: "POST", headers: jh(), body: JSON.stringify({ reason: "mistake" }) }, ENV)).status).toBe(200);
  });
  it("invoice-files GET /:id streams a PDF", async () => {
    const res = await (await app()).request("/api/v1/invoice-files/i1", { headers: headers("se") }, ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });
});
