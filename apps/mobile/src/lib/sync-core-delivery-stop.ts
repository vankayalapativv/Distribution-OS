/** Delivery-stop writes: local record (offline) + server-mirror of a fulfilled stop. */
import { type LocalDb, withTransaction } from "./local-db";
import { enqueue } from "./sync-core-types";

export interface DeliveryStopInput {
  clientUuid: string;
  runClientUuid: string;
  customerId: string;
  customerName: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The invoice this delivery fulfils (fulfillment link) — null if none. */
  invoiceId: string | null;
  invoiceNumber: string | null;
  /** Local uris of the mandatory delivery proof photos (uploaded best-effort). */
  photoPaths: string[];
}

/**
 * Offline path: write the stop locally + enqueue it, atomically. The sync-send
 * handler resolves the run's server id (FIFO guarantees the start synced first),
 * POSTs the stop, and uploads its photos.
 */
export function recordDeliveryStop(db: LocalDb, input: DeliveryStopInput, now: number): void {
  withTransaction(db, () => {
    db.run(
      `insert into delivery_stops (client_uuid, run_client_uuid, customer_id, customer_name, latitude, longitude, invoice_id, invoice_number, photo_paths, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.clientUuid,
        input.runClientUuid,
        input.customerId,
        input.customerName,
        input.latitude,
        input.longitude,
        input.invoiceId,
        input.invoiceNumber,
        JSON.stringify(input.photoPaths),
        now,
      ],
    );
    enqueue(db, "delivery_stop", input.clientUuid, {
      runClientUuid: input.runClientUuid,
      customerId: input.customerId,
      latitude: input.latitude,
      longitude: input.longitude,
      invoiceId: input.invoiceId,
      clientUuid: input.clientUuid,
    }, now);
  });
}

/**
 * Cache a stop that was ALREADY saved on the server (see deliver-stop-actions.ts)
 * so it shows in the local "delivered today" list right away. Marked fully-synced
 * (server_id set, photos_uploaded = 1). Best-effort for the caller: on a
 * read-only DB this throws and is ignored, and the stop simply appears after the
 * next server-first refresh instead.
 */
export function mirrorSentDeliveryStop(
  db: LocalDb,
  input: DeliveryStopInput & { serverId: string },
  now: number,
): void {
  db.run(
    `insert or replace into delivery_stops
       (client_uuid, server_id, run_client_uuid, customer_id, customer_name, latitude, longitude, invoice_id, invoice_number, photo_paths, photos_uploaded, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      input.clientUuid,
      input.serverId,
      input.runClientUuid,
      input.customerId,
      input.customerName,
      input.latitude,
      input.longitude,
      input.invoiceId,
      input.invoiceNumber,
      JSON.stringify(input.photoPaths),
      now,
    ],
  );
}
