import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  recomputeOrderFulfillment: vi.fn().mockResolvedValue(undefined),
  getOrderById: vi.fn().mockResolvedValue({ id: "ord-1", stub: true }),
}));
vi.mock("./fulfillment", () => ({ recomputeOrderFulfillment: h.recomputeOrderFulfillment }));
vi.mock("./orders-queries", () => ({ getOrderById: h.getOrderById }));

import {
  cancelOrder,
  createOrder,
  customerOwnerSE,
  prepareOrderItems,
  updateOrder,
} from "./orders";
import { makeSql, calledTag } from "../test/sql-mock";

const CTX = { userId: "admin-1" };
const CUST = "cust-1";

afterEach(() => vi.clearAllMocks());

describe("prepareOrderItems", () => {
  it("rejects a line without a productId", async () => {
    await expect(prepareOrderItems(makeSql(), [{ quantityUnits: 1 } as never])).rejects.toMatchObject({ status: 422 });
  });

  it("enriches a litres product and computes total litres", async () => {
    const sql = makeSql({ get_products_for_order: [{ id: "p1", brand: "Fuchs", unit: "litres" }] });
    const { enrichedItems, totalLitres } = await prepareOrderItems(sql, [
      { productId: "p1", quantityUnits: 3, packSizeLitres: 5, segment: "Car" },
    ]);
    expect(enrichedItems[0]).toMatchObject({ brand: "Fuchs", totalLitres: 15, packSizeLitres: 5 });
    expect(totalLitres).toBe(15);
  });

  it("enriches a quantity-unit product with null pack/litres", async () => {
    const sql = makeSql({ get_products_for_order: [{ id: "pq", brand: null, unit: "quantity" }] });
    const { enrichedItems, totalLitres } = await prepareOrderItems(sql, [{ productId: "pq", quantityUnits: 4 }]);
    expect(enrichedItems[0]).toMatchObject({ packSizeLitres: null, totalLitres: null, brand: null });
    expect(totalLitres).toBe(0);
  });

  it("rejects unknown product, bad quantity, and a missing pack size", async () => {
    const empty = makeSql({ get_products_for_order: [] });
    await expect(prepareOrderItems(empty, [{ productId: "x", quantityUnits: 1 }])).rejects.toMatchObject({ status: 422 });
    const sql = makeSql({ get_products_for_order: [{ id: "p1", brand: null, unit: "litres" }] });
    await expect(prepareOrderItems(sql, [{ productId: "p1", quantityUnits: 0 }])).rejects.toMatchObject({ status: 422 });
    await expect(prepareOrderItems(sql, [{ productId: "p1", quantityUnits: 2 }])).rejects.toMatchObject({ status: 422 }); // no pack
  });
});

describe("customerOwnerSE", () => {
  it("returns the owning SE id, or null", async () => {
    expect(await customerOwnerSE(makeSql({ customer_owner_se: [{ seId: "se-1" }] }), CUST)).toBe("se-1");
    expect(await customerOwnerSE(makeSql({ customer_owner_se: [] }), CUST)).toBeNull();
  });
});

const PRODUCTS = { get_products_for_order: [{ id: "p1", brand: "Fuchs", unit: "litres" }] };
const orderItem = { productId: "p1", quantityUnits: 2, packSizeLitres: 5, segment: "Car" };

describe("createOrder", () => {
  it("rejects empty items / missing customer (422)", async () => {
    await expect(createOrder(makeSql(), CTX, { customerId: CUST, items: [] } as never)).rejects.toMatchObject({ status: 422 });
    await expect(createOrder(makeSql(), CTX, { customerId: "", items: [orderItem] } as never)).rejects.toMatchObject({ status: 422 });
  });

  it("creates the order + items and recomputes fulfillment", async () => {
    const sql = makeSql({
      ...PRODUCTS,
      customer_owner_se: [{ seId: "se-1" }],
      next_order_code: [{ next_seq: 1 }],
      create_order: [{ id: "ord-1", orderCode: "ORD-0001", customerId: CUST }],
      create_order_item: [],
    });
    const res = await createOrder(sql, CTX, { customerId: CUST, items: [orderItem] } as never);
    expect(res).toMatchObject({ existing: false });
    expect(h.recomputeOrderFulfillment).toHaveBeenCalledWith(sql, "ord-1");
  });

  it("replays an existing order up-front by clientUuid", async () => {
    const sql = makeSql({
      get_order_by_client_uuid: [{ id: "ord-1", orderCode: "ORD-0001", customerId: CUST }],
      get_order_items: [],
    });
    const res = await createOrder(sql, CTX, { customerId: CUST, clientUuid: "u1", items: [orderItem] } as never);
    expect(res).toMatchObject({ existing: true });
  });

  it("recovers the winner on a concurrent client_uuid race, and rethrows other errors", async () => {
    let seen = 0;
    const sql = makeSql({
      get_order_by_client_uuid: () => (seen++ === 0 ? [] : [{ id: "ord-1", orderCode: "ORD-0001", customerId: CUST }]),
      ...PRODUCTS,
      customer_owner_se: [],
      next_order_code: [{ next_seq: 1 }],
    });
    (sql as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw Object.assign(new Error("dup"), { code: "23505", constraint: "orders_client_uuid_unique" });
    };
    const res = await createOrder(sql, CTX, { customerId: CUST, clientUuid: "u1", items: [orderItem] } as never);
    expect(res).toMatchObject({ existing: true });

    const boom = makeSql({ ...PRODUCTS, customer_owner_se: [], next_order_code: [{ next_seq: 1 }] });
    (boom as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw new Error("db boom");
    };
    await expect(createOrder(boom, CTX, { customerId: CUST, items: [orderItem] } as never)).rejects.toThrow("db boom");
  });
});

describe("updateOrder", () => {
  const input = { customerId: CUST, items: [orderItem] };
  const agg = (over: Record<string, unknown>) => ({ order_fulfillment_for_update: [{ invoiceCount: 0, deliveredCount: 0, invOil: 0, ordOil: 0, ...over }] });

  it("rejects empty items / missing customer (422)", async () => {
    await expect(updateOrder(makeSql(), CTX, "ord-1", { customerId: CUST, items: [] })).rejects.toMatchObject({ status: 422 });
    await expect(updateOrder(makeSql(), CTX, "ord-1", { customerId: "", items: [orderItem] })).rejects.toMatchObject({ status: 422 });
  });

  it("404s when the order is missing", async () => {
    await expect(updateOrder(makeSql({ order_fulfillment_for_update: [] }), CTX, "x", input)).rejects.toMatchObject({ status: 404 });
  });

  it("409s an invoiced or fully-delivered order", async () => {
    await expect(updateOrder(makeSql(agg({ invoiceCount: 1, deliveredCount: 0 })), CTX, "ord-1", input)).rejects.toMatchObject({ status: 409 });
    await expect(updateOrder(makeSql(agg({ invoiceCount: 1, deliveredCount: 1, invOil: 100, ordOil: 100 })), CTX, "ord-1", input)).rejects.toMatchObject({ status: 409 });
  });

  it("fully replaces an un-invoiced (ordered) order", async () => {
    const sql = makeSql({ ...agg({}), ...PRODUCTS });
    await updateOrder(sql, CTX, "ord-1", input);
    expect(calledTag(sql, "update_order_header")).toBe(true);
    expect(calledTag(sql, "clear_order_items")).toBe(true);
    expect(h.getOrderById).toHaveBeenCalledWith(sql, CTX, "ord-1");
  });

  it("edits only the un-invoiced remainder of a partially-delivered order", async () => {
    const sql = makeSql({
      ...agg({ invoiceCount: 2, deliveredCount: 1, invOil: 50, ordOil: 100 }),
      order_items_for_partial_update: [
        { id: "oi-1", isOil: true, packSizeLitres: "5", invoicedUnits: "2" }, // billed → locked
        { id: "oi-2", isOil: true, packSizeLitres: "5", invoicedUnits: "0" }, // un-billed → removable
      ],
      ...PRODUCTS,
    });
    await updateOrder(sql, CTX, "ord-1", {
      customerId: CUST,
      items: [{ orderItemId: "oi-1", quantityUnits: 3 }, { productId: "p1", quantityUnits: 1, packSizeLitres: 5 }],
    });
    expect(calledTag(sql, "partial_update_locked_line")).toBe(true);
    expect(h.recomputeOrderFulfillment).toHaveBeenCalledWith(sql, "ord-1");
  });

  it("rejects an unknown locked line and a reduction below the invoiced qty", async () => {
    const partial = {
      ...agg({ invoiceCount: 2, deliveredCount: 1, invOil: 50, ordOil: 100 }),
      order_items_for_partial_update: [{ id: "oi-1", isOil: true, packSizeLitres: "5", invoicedUnits: "2" }],
      ...PRODUCTS,
    };
    await expect(updateOrder(makeSql(partial), CTX, "ord-1", { customerId: CUST, items: [{ orderItemId: "ghost", quantityUnits: 1 }] })).rejects.toMatchObject({ status: 422 });
    await expect(updateOrder(makeSql(partial), CTX, "ord-1", { customerId: CUST, items: [{ orderItemId: "oi-1", quantityUnits: 1 }] })).rejects.toMatchObject({ status: 422 });
  });
});

describe("cancelOrder", () => {
  it("404s missing / 409s already-cancelled", async () => {
    await expect(cancelOrder(makeSql({ get_order_for_cancel: [] }), CTX, "x")).rejects.toMatchObject({ status: 404 });
    await expect(
      cancelOrder(makeSql({ get_order_for_cancel: [{ id: "ord-1", orderCode: "ORD-0001", orderStatus: "cancelled" }] }), CTX, "ord-1"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("409s a fully-invoiced order (nothing left to cancel)", async () => {
    const sql = makeSql({
      get_order_for_cancel: [{ id: "ord-1", orderCode: "ORD-0001", orderStatus: "approved" }],
      order_cancel_totals: [{ invoicedUnits: "5", remainingUnits: "0" }],
    });
    await expect(cancelOrder(sql, CTX, "ord-1")).rejects.toMatchObject({ status: 409 });
  });

  it("fully voids an un-invoiced order", async () => {
    const sql = makeSql({
      get_order_for_cancel: [{ id: "ord-1", orderCode: "ORD-0001", orderStatus: "approved" }],
      order_cancel_totals: [{ invoicedUnits: "0", remainingUnits: "10" }],
    });
    const res = await cancelOrder(sql, CTX, "ord-1", "  changed mind  ");
    expect(res).toMatchObject({ mode: "cancelled", cancellationNote: "changed mind" });
    expect(calledTag(sql, "cancel_order")).toBe(true);
  });

  it("short-closes a partially-invoiced order's remainder", async () => {
    const sql = makeSql({
      get_order_for_cancel: [{ id: "ord-1", orderCode: "ORD-0001", orderStatus: "approved" }],
      order_cancel_totals: [{ invoicedUnits: "3", remainingUnits: "2" }],
    });
    const res = await cancelOrder(sql, CTX, "ord-1", null);
    expect(res).toMatchObject({ mode: "short_closed", cancellationNote: null });
    expect(calledTag(sql, "short_close_lines")).toBe(true);
  });
});
