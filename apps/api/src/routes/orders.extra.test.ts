import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

const M = vi.hoisted(() => ({ future: vi.fn((..._a: unknown[]) => false) }));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../lib/wait-until", () => ({ waitUntilSafe: (_c: unknown, p: Promise<unknown>) => p }));
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/orders", () => ({
  cancelOrder: vi.fn().mockResolvedValue({ id: "o1", orderCode: "ORD-1", cancellationNote: "oops" }),
  createOrder: vi.fn().mockResolvedValue({ existing: false, id: "o1", orderCode: "ORD-1", customerName: "Ravi" }),
  getOrderById: vi.fn().mockResolvedValue({ id: "o1", customerId: "c1" }),
  listOrderInvoiceableItems: vi.fn().mockResolvedValue({ items: [] }),
  listOrders: vi.fn().mockResolvedValue([]),
  listOrdersPaged: vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 20 }),
  listProducts: vi.fn().mockResolvedValue([]),
  listRecentOrdersByCustomerBulk: vi.fn().mockResolvedValue({ byCustomer: {} }),
  listSalesExecutives: vi.fn().mockResolvedValue([]),
  orderFulfillmentSummary: vi.fn().mockResolvedValue({ ordered: 0 }),
  updateOrder: vi.fn().mockResolvedValue({ id: "o1", orderCode: "ORD-1" }),
}));
vi.mock("../services/customers", () => ({ assertCustomerVisible: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/order-date", () => ({ isFutureOrderDate: (...a: unknown[]) => M.future(...a) }));
vi.mock("../services/web-push-notify", () => ({
  executiveFirstName: vi.fn().mockResolvedValue("Asha"),
  notifyOfficeWebPush: vi.fn().mockResolvedValue(undefined),
  vapidFromEnv: () => ({ publicKey: "p", privateKey: "s", subject: "mailto:a@b.co" }),
}));
vi.mock("../services/admin-notify", () => ({ notifyAdmins: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/notify-format", () => ({ orderBody: () => "Asha · ORD-1 · Ravi" }));

const UUID = "11111111-2222-4333-8444-555555555555";
const jh = (r: Parameters<typeof headers>[0] = "superAdmin") => ({ ...headers(r), "content-type": "application/json" });
const items = [{ productId: "p1", quantityUnits: 2, packSizeLitres: 5, segment: "Car" }];
beforeEach(() => { vi.resetModules(); installAuth(); M.future.mockReset(); M.future.mockReturnValue(false); });
const app = () => import("../index").then((m) => m.default);

describe("orders — list/detail variants", () => {
  it("recent-bulk (SE), sales-executives, paged, fulfillment-summary", async () => {
    expect((await (await app()).request("/api/v1/orders/recent-bulk?since=2026-06-01", { headers: headers("se") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/orders/sales-executives", { headers: headers("manager") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/orders/paged?status=pending&customerId=c1&city=Hyd&salesExecutiveId=se-1&dateFrom=2026-06-01&dateTo=2026-06-30&search=x&fulfillment=open&sort=date&dir=desc&page=1&pageSize=20", { headers: headers("manager") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/orders/fulfillment-summary", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("GET /:id as SE (scoped) + /:id/invoiceable", async () => {
    expect((await (await app()).request(`/api/v1/orders/${UUID}`, { headers: headers("se") }, ENV)).status).toBe(200);
    expect((await (await app()).request(`/api/v1/orders/${UUID}/invoiceable?excludeInvoiceId=i1`, { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
});

describe("orders — create/edit/cancel", () => {
  it("POST / — SE create fires notifications", async () => {
    const res = await (await app()).request("/api/v1/orders", { method: "POST", headers: jh("se"), body: JSON.stringify({ customerId: "c1", items }) }, ENV);
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 20));
    const { notifyOfficeWebPush } = await import("../services/web-push-notify");
    expect(notifyOfficeWebPush).toHaveBeenCalled();
  });
  it("POST / — office 422 on future date, 201 otherwise", async () => {
    M.future.mockReturnValue(true);
    expect((await (await app()).request("/api/v1/orders", { method: "POST", headers: jh("manager"), body: JSON.stringify({ customerId: "c1", orderDate: "2099-01-01", items }) }, ENV)).status).toBe(422);
    M.future.mockReturnValue(false);
    expect((await (await app()).request("/api/v1/orders", { method: "POST", headers: jh("manager"), body: JSON.stringify({ customerId: "c1", salesExecutiveId: "se-1", items }) }, ENV)).status).toBe(201);
  });
  it("POST / — 422 on empty items / missing customer", async () => {
    expect((await (await app()).request("/api/v1/orders", { method: "POST", headers: jh("manager"), body: JSON.stringify({ customerId: "c1", items: [] }) }, ENV)).status).toBe(422);
    expect((await (await app()).request("/api/v1/orders", { method: "POST", headers: jh("manager"), body: JSON.stringify({ items }) }, ENV)).status).toBe(422);
  });
  it("PATCH /:id — 422 empty items / missing customer / future, 200 ok", async () => {
    expect((await (await app()).request(`/api/v1/orders/${UUID}`, { method: "PATCH", headers: jh("manager"), body: JSON.stringify({ customerId: "c1", items: [] }) }, ENV)).status).toBe(422);
    expect((await (await app()).request(`/api/v1/orders/${UUID}`, { method: "PATCH", headers: jh("manager"), body: JSON.stringify({ items }) }, ENV)).status).toBe(422);
    M.future.mockReturnValue(true);
    expect((await (await app()).request(`/api/v1/orders/${UUID}`, { method: "PATCH", headers: jh("manager"), body: JSON.stringify({ customerId: "c1", orderDate: "2099-01-01", items }) }, ENV)).status).toBe(422);
    M.future.mockReturnValue(false);
    expect((await (await app()).request(`/api/v1/orders/${UUID}`, { method: "PATCH", headers: jh("manager"), body: JSON.stringify({ customerId: "c1", salesExecutiveId: "se-1", items }) }, ENV)).status).toBe(200);
  });
  it("POST /:id/cancel with a note", async () => {
    expect((await (await app()).request(`/api/v1/orders/${UUID}/cancel`, { method: "POST", headers: jh("manager"), body: JSON.stringify({ note: "oops" }) }, ENV)).status).toBe(200);
  });
});
