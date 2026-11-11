import { describe, expect, it } from "vitest";
import {
  getOrderById,
  listOrderInvoiceableItems,
  listOrders,
  listOrdersPaged,
  listProducts,
  listRecentOrdersByCustomerBulk,
  listSalesExecutives,
  orderFulfillmentSummary,
} from "./orders-queries";
import { makeSql } from "../test/sql-mock";

const CTX = { userId: "u1", role: "SUPER_ADMIN" as const };
const ORDER_ROW = { id: "ord-1", orderCode: "ORD-0001", customerId: "c1", orderStatus: "approved" };

describe("listSalesExecutives / listProducts", () => {
  it("lists active SEs", async () => {
    const sql = makeSql({ list_sales_executives: [{ id: "se-1", name: "Asha" }] });
    expect(await listSalesExecutives(sql, CTX)).toEqual([{ id: "se-1", name: "Asha" }]);
  });
  it("lists products with default (omitted) filters", async () => {
    const sql = makeSql({ list_products: [{ id: "p1", productName: "Titan", brand: "Fuchs", unit: "litres", segments: ["Car"], packSizes: [5] }] });
    const [p] = await listProducts(sql, CTX);
    expect(p).toMatchObject({ id: "p1", productName: "Titan" });
  });
});

describe("listOrders / listOrdersPaged", () => {
  it("maps the plain order list", async () => {
    const sql = makeSql({ list_orders: [ORDER_ROW] });
    expect((await listOrders(sql, CTX, {}))[0]).toMatchObject({ id: "ord-1" });
  });

  it("builds the digits-only phone search + a fulfillment-stage filter", async () => {
    const sql = makeSql({ list_orders_paged_count: [{ total: 1 }], list_orders_paged: [ORDER_ROW] });
    const res = await listOrdersPaged(sql, CTX, { search: "99597 14221", fulfillment: "ordered", page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    const countCall = sql.calls.find((c) => c.tag === "list_orders_paged_count")!;
    expect(countCall.params).toContain("%9959714221%"); // digits-only phone term
    expect(countCall.params).toContain("ordered"); // fulfillment stage
  });

  it("filters the cancelled bucket", async () => {
    const sql = makeSql({ list_orders_paged_count: [{ total: 0 }], list_orders_paged: [] });
    const res = await listOrdersPaged(sql, CTX, { fulfillment: "cancelled" });
    expect(res.total).toBe(0);
    const countCall = sql.calls.find((c) => c.tag === "list_orders_paged_count")!;
    expect(countCall.text).toMatch(/order_status = 'cancelled'/);
  });
});

describe("listRecentOrdersByCustomerBulk", () => {
  it("cold pull: Date serverTime → ISO, no delta filter", async () => {
    const sql = makeSql({ "": [{ serverTime: new Date("2026-06-30T12:00:00Z") }], bulk_recent_orders: [ORDER_ROW] });
    const out = await listRecentOrdersByCustomerBulk(sql, CTX);
    expect(out.serverTime).toBe("2026-06-30T12:00:00.000Z");
    expect(out.orders[0]).toMatchObject({ id: "ord-1" });
    const call = sql.calls.find((c) => c.tag === "bulk_recent_orders")!;
    expect(call.params).toEqual(["u1", 5]); // no $3 since
  });

  it("delta pull: string serverTime + the changed-customers filter ($3)", async () => {
    const sql = makeSql({ "": [{ serverTime: "2026-06-30T12:00:00Z" }], bulk_recent_orders: [] });
    const out = await listRecentOrdersByCustomerBulk(sql, CTX, 5, "2026-06-01T00:00:00Z");
    expect(out.serverTime).toBe("2026-06-30T12:00:00Z");
    const call = sql.calls.find((c) => c.tag === "bulk_recent_orders")!;
    expect(call.params).toEqual(["u1", 5, "2026-06-01T00:00:00Z"]);
    expect(call.text).toMatch(/o\.customer_id in \(/);
  });
});

describe("orderFulfillmentSummary", () => {
  it("maps the funnel counts", async () => {
    const sql = makeSql({
      order_fulfillment_summary: [{
        returned: "1", partiallyReturned: "2", ordered: "3", partiallyInvoiced: "0",
        invoiced: "4", partiallyDelivered: "1", delivered: "5", partiallyCancelled: "0", cancelled: "2",
      }],
    });
    const out = await orderFulfillmentSummary(sql);
    expect(out).toMatchObject({ returned: 1, ordered: 3, delivered: 5 });
  });
});

describe("getOrderById", () => {
  it("maps header + items + shipments + per-SKU progress", async () => {
    const sql = makeSql({
      get_order_by_id: [ORDER_ROW],
      get_order_items: [],
      get_order_shipments: [],
      get_order_sku_progress: [
        { id: "oi-1", label: "Titan", packSizeLitres: "5", orderedUnits: "10", cancelledUnits: "0", invoicedUnits: "4", returnedUnits: "0" },
      ],
    });
    const out = await getOrderById(sql, CTX, "ord-1");
    expect(out).toMatchObject({ id: "ord-1" });
    expect(out.skuProgress[0]).toMatchObject({ orderItemId: "oi-1", orderedUnits: 10, invoicedUnits: 4, remainingUnits: 6 });
    expect(out.fulfillment.delivery).toBeNull(); // no shipment
  });
});

describe("listOrderInvoiceableItems", () => {
  it("404s a missing order", async () => {
    await expect(listOrderInvoiceableItems(makeSql({ invoiceable_order_status: [] }), CTX, "x")).rejects.toMatchObject({ status: 404 });
  });

  it("returns per-SKU ordered/invoiced/remaining", async () => {
    const sql = makeSql({
      invoiceable_order_status: [{ orderStatus: "approved", customerName: "Ravi", customerPhone: "999" }],
      order_invoiceable_items: [
        { id: "oi-1", label: "Titan", hsnCode: "27101980", packSizeLitres: "5", orderedUnits: "10", invoicedUnits: "4" },
      ],
    });
    const out = await listOrderInvoiceableItems(sql, CTX, "ord-1");
    expect(out).toMatchObject({ orderStatus: "approved", customerName: "Ravi" });
    expect(out.items[0]).toMatchObject({ orderItemId: "oi-1", orderedUnits: 10, invoicedUnits: 4, remainingUnits: 6 });
  });
});
