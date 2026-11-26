import type { LocalDb } from "../local-db";

/**
 * Local mirror of the server's "visit has an outcome" rule: an order OR a
 * collection for this customer on the visit day. The local `orders`/`collections`
 * tables are this device's outbox, so for a SALES_EXECUTIVE (who records all
 * their own sales here) this matches the server — letting an OFFLINE check-out
 * decide upfront whether the mandatory no-outcome reason is needed, instead of
 * prompting for it on every offline close.
 */
export function localVisitHasOutcome(db: LocalDb, customerId: string, isoDate: string): boolean {
  const order = db.first(
    "select 1 from orders where customer_id = ? and order_date like ? || '%' limit 1",
    [customerId, isoDate],
  );
  if (order) return true;
  const collection = db.first(
    "select 1 from collections where customer_id = ? and collection_date like ? || '%' limit 1",
    [customerId, isoDate],
  );
  return Boolean(collection);
}
