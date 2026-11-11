import { describe, expect, test } from "vitest";
import { freshDb, NOW } from "../sync-core.test-support";
import { flushOnce, getQueueStats, type SyncTransport } from "../sync-core";
import { recordOrder } from "./order-queue";

const CUST = "cust-1";
const ORDER_UUID = "bbbbbbbb-0000-4000-8000-000000000001";

const transport: SyncTransport = {
  async send(item) {
    if (item.entityType === "order") return { order: { id: "srv-order-1", orderCode: "ORD-0001" } };
    return {};
  },
};

describe("offline order queue", () => {
  test("recordOrder writes the header + line items + oils-only litres total, and enqueues", () => {
    const db = freshDb();
    recordOrder(
      db,
      {
        clientUuid: ORDER_UUID,
        customerId: CUST,
        orderDate: "2026-10-14",
        items: [
          { productId: "p1", quantityUnits: 2, packSizeLitres: 5, segment: "Car" },
          { productId: "p2", quantityUnits: 1, packSizeLitres: 20, segment: "Commercial" },
        ],
      },
      NOW,
    );

    const order = db.first<{ total_litres: number; customer_id: string }>(
      "select total_litres, customer_id from orders where client_uuid = ?",
      [ORDER_UUID],
    );
    expect(order?.customer_id).toBe(CUST);
    expect(order?.total_litres).toBe(2 * 5 + 1 * 20); // 30 L

    const items = db.all<{ product_id: string; quantity_units: number }>(
      "select product_id, quantity_units from order_items where order_client_uuid = ? order by product_id",
      [ORDER_UUID],
    );
    expect(items).toHaveLength(2);
    expect(items[0]?.product_id).toBe("p1");
    expect(getQueueStats(db)).toEqual({ pending: 1, failed: 0 });
  });

  test("flushing an order maps the server id + code onto the local row", async () => {
    const db = freshDb();
    recordOrder(
      db,
      { clientUuid: ORDER_UUID, customerId: CUST, orderDate: "2026-10-14", items: [{ productId: "p1", quantityUnits: 1, packSizeLitres: 1, segment: null }] },
      NOW,
    );
    const res = await flushOnce(db, transport, NOW);
    expect(res.sent).toBe(1);
    const order = db.first<{ server_id: string | null; order_code: string | null }>(
      "select server_id, order_code from orders where client_uuid = ?",
      [ORDER_UUID],
    );
    expect(order?.server_id).toBe("srv-order-1");
    expect(order?.order_code).toBe("ORD-0001");
    expect(getQueueStats(db)).toEqual({ pending: 0, failed: 0 });
  });

  test("the order header + items + enqueue are atomic (all-or-nothing)", () => {
    const db = freshDb();
    // A bad item (no product id still inserts; force a failure by
    // violating the NOT NULL on orders via a duplicate primary key on retry).
    recordOrder(db, { clientUuid: ORDER_UUID, customerId: CUST, orderDate: "2026-10-14", items: [{ productId: "p1", quantityUnits: 1, packSizeLitres: 1 }] }, NOW);
    expect(() =>
      // Same clientUuid → duplicate orders PK → the whole transaction rolls back.
      recordOrder(db, { clientUuid: ORDER_UUID, customerId: CUST, orderDate: "2026-10-14", items: [{ productId: "p2", quantityUnits: 9, packSizeLitres: 1 }] }, NOW),
    ).toThrow();
    // The failed retry left nothing extra: still one order, one item, one queued.
    const orders = db.all("select client_uuid from orders");
    const items = db.all("select id from order_items");
    expect(orders).toHaveLength(1);
    expect(items).toHaveLength(1);
    expect(getQueueStats(db)).toEqual({ pending: 1, failed: 0 });
  });
});
