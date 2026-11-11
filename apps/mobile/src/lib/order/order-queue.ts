/**
 * Offline order write: records the order to the local outbox (an `orders`
 * header + its `order_items`) and enqueues the `order` write, all atomically.
 * The enqueue payload is byte-for-byte what `submitOrder` POSTs, so the queued
 * replay is identical to a direct submit (idempotent via clientUuid).
 *
 * Distribution OS's order screen is oils-only; a line carries a product + pack
 * size + segment.
 */
import { type LocalDb, withTransaction } from "../local-db";
import { enqueue } from "../sync-core";
import type { OrderItemPayload } from "./api";

export interface OrderQueueInput {
  clientUuid: string;
  customerId: string;
  orderDate: string;
  items: OrderItemPayload[];
}

export function recordOrder(db: LocalDb, input: OrderQueueInput, now: number): void {
  const totalLitres = input.items.reduce(
    (s, i) => s + i.quantityUnits * (i.packSizeLitres ?? 0),
    0,
  );
  withTransaction(db, () => {
    db.run(
      `insert into orders (client_uuid, customer_id, order_date, total_litres, created_at)
       values (?, ?, ?, ?, ?)`,
      [input.clientUuid, input.customerId, input.orderDate, totalLitres, now],
    );
    for (const item of input.items) {
      db.run(
        `insert into order_items (order_client_uuid, product_id, quantity_units, pack_size_litres, segment)
         values (?, ?, ?, ?, ?)`,
        [
          input.clientUuid,
          item.productId ?? null,
          item.quantityUnits,
          item.packSizeLitres ?? null,
          item.segment ?? null,
        ],
      );
    }
    enqueue(
      db,
      "order",
      input.clientUuid,
      {
        customerId: input.customerId,
        orderDate: input.orderDate,
        clientUuid: input.clientUuid,
        items: input.items,
      },
      now,
    );
  });
}
