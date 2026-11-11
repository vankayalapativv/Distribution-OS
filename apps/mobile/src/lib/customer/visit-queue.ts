/**
 * Offline visit writes for the customer-page check-in / check-out.
 *
 * Sri Aparajita's field check-in is an *unplanned* visit (from the customer
 * page, no beat stop). The local `visits` row is keyed by the check-in's
 * deterministic `clientUuid`; its `server_id` is filled in by the sync-send
 * handler once the check-in POST succeeds. FIFO ordering guarantees a same-day
 * offline check-in is sent before its check-out.
 */
import type { LocalDb } from "../local-db";
import { enqueue } from "../sync-core";

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

export interface CheckInQueueInput {
  clientUuid: string;
  customerId: string;
  latitude: number;
  longitude: number;
}

/** Write the local visit row + enqueue the check-in (offline path). */
export function recordVisitCheckin(db: LocalDb, input: CheckInQueueInput, now: number): void {
  db.run(
    `insert or ignore into visits
       (client_uuid, customer_id, check_in_time, check_in_latitude, check_in_longitude, status, created_at)
     values (?, ?, ?, ?, ?, 'checked_in', ?)`,
    [
      input.clientUuid,
      input.customerId,
      new Date(now).toISOString(),
      input.latitude,
      input.longitude,
      now,
    ],
  );
  enqueue(db, "visit_checkin", input.clientUuid, {
    customerId: input.customerId,
    latitude: input.latitude,
    longitude: input.longitude,
    clientUuid: input.clientUuid,
  }, now);
}

export interface CheckoutQueueInput {
  /** clientUuid of the visit being closed (the key the check-in used). */
  clientUuid: string;
  /** Server visit id when already known (visit checked in on a synced day). */
  serverId: string | null;
  customerId: string;
  latitude: number;
  longitude: number;
  /** Mandatory no-outcome reason when there was no order/collection. */
  noOutcomeReason?: string;
  /** Optional follow-up reminder time the SE picked (sent so the server creates
   *  the follow-up on sync, matching the online path). */
  followUpAt?: string | null;
}

/**
 * Queue an offline check-out. Ensures a local `visits` row exists (so the
 * sync-send `visit_checkout` handler can resolve the server id once the check-in
 * syncs), stamps the local check-out time, and enqueues the write.
 */
export function ensureCheckoutQueued(
  db: LocalDb,
  input: CheckoutQueueInput,
  now: number,
): void {
  const existing = db.first<{ client_uuid: string }>(
    "select client_uuid from visits where client_uuid = ? limit 1",
    [input.clientUuid],
  );
  if (!existing) {
    // A header-only visit (checked in on a synced day, no local row yet): seed
    // one carrying the known server id so the queue can target the checkout.
    db.run(
      `insert into visits
         (client_uuid, server_id, customer_id, check_in_time, status, created_at)
       values (?, ?, ?, ?, 'checked_in', ?)`,
      [input.clientUuid, input.serverId, input.customerId, new Date(now).toISOString(), now],
    );
  } else if (input.serverId) {
    db.run("update visits set server_id = ? where client_uuid = ? and server_id is null", [
      input.serverId,
      input.clientUuid,
    ]);
  }
  db.run("update visits set check_out_time = ?, status = 'completed' where client_uuid = ?", [
    new Date(now).toISOString(),
    input.clientUuid,
  ]);
  enqueue(db, "visit_checkout", input.clientUuid, {
    latitude: input.latitude,
    longitude: input.longitude,
    ...(input.noOutcomeReason ? { reason: input.noOutcomeReason } : {}),
    ...(input.followUpAt ? { followUpAt: input.followUpAt } : {}),
  }, now);
}
