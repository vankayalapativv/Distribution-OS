// ── Flush ────────────────────────────────────────────────────────────────────
import type { LocalDb } from "./local-db";
import type { SyncQueueItem } from "./sync-core-types";

type Json = Record<string, unknown>;

/** A string field, or null when absent/not a string. */
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function applyVisitCheckin(db: LocalDb, item: SyncQueueItem, data: Json): void {
  const visitId = str(data.visitId);
  if (visitId) {
    db.run("update visits set server_id = ? where client_uuid = ?", [visitId, item.clientUuid]);
  }
}

function applyOrder(db: LocalDb, item: SyncQueueItem, data: Json): void {
  const order = data.order as Json | undefined;
  const id = str(order?.id);
  if (id) {
    db.run("update orders set server_id = ?, order_code = ? where client_uuid = ?", [
      id,
      str(order?.orderCode),
      item.clientUuid,
    ]);
  }
}

function applyCollection(db: LocalDb, item: SyncQueueItem, data: Json): void {
  const id = str(data.id);
  if (id) {
    db.run("update collections set server_id = ?, collection_code = ? where client_uuid = ?", [
      id,
      str(data.collectionCode),
      item.clientUuid,
    ]);
  }
}

/** Map an id from `data` onto one column of `table` for the given client_uuid. */
function applyServerId(db: LocalDb, table: string, item: SyncQueueItem, data: Json): void {
  const id = str(data.id);
  if (id) {
    db.run(`update ${table} set server_id = ? where client_uuid = ?`, [id, item.clientUuid]);
  }
}

export function applyServerResult(
  db: LocalDb,
  item: SyncQueueItem,
  data: Record<string, unknown> | undefined,
): void {
  if (!data) return;

  switch (item.entityType) {
    case "visit_checkin":
      return applyVisitCheckin(db, item, data);
    case "order":
      return applyOrder(db, item, data);
    case "collection":
      return applyCollection(db, item, data);
    case "visit_checkout":
      db.run("update visits set status = 'completed' where client_uuid = ?", [item.clientUuid]);
      return;
    case "delivery_start":
      return applyServerId(db, "delivery_runs", item, data);
    case "delivery_stop":
      return applyServerId(db, "delivery_stops", item, data);
    case "delivery_end":
      // The run already carries its server_id (set when delivery_start synced);
      // nothing more to map here.
      return;
  }
}
