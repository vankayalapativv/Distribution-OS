// ── Queue inspection ─────────────────────────────────────────────────────────
import type { LocalDb } from "./local-db";
import type { SyncEntityType, SyncQueueItem } from "./sync-core-types";

interface QueueRow {
  id: number;
  client_uuid: string;
  entity_type: string;
  payload: string;
  attempts: number;
}

function toItem(row: QueueRow): SyncQueueItem {
  return {
    id: row.id,
    clientUuid: row.client_uuid,
    entityType: row.entity_type as SyncEntityType,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    attempts: row.attempts,
  };
}

export function getDueItems(db: LocalDb, now: number): SyncQueueItem[] {
  return db
    .all<QueueRow>(
      `select id, client_uuid, entity_type, payload, attempts
       from sync_queue
       where status = 'pending' and next_attempt_at <= ?
       order by id`,
      [now],
    )
    .map(toItem);
}

export function getQueueStats(db: LocalDb): { pending: number; failed: number } {
  const row = db.first<{ pending: number; failed: number }>(
    `select
       sum(case when status = 'pending' then 1 else 0 end) as pending,
       sum(case when status = 'failed' then 1 else 0 end) as failed
     from sync_queue`,
  );
  return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
}

export interface FailedItem {
  id: number;
  entityType: SyncEntityType;
  lastError: string | null;
  createdAt: number;
}

/** Permanently-failed items, for the Settings sync inspector. */
export function getFailedItems(db: LocalDb): FailedItem[] {
  return db
    .all<{ id: number; entity_type: string; last_error: string | null; created_at: number }>(
      "select id, entity_type, last_error, created_at from sync_queue where status = 'failed' order by id",
    )
    .map((r) => ({
      id: r.id,
      entityType: r.entity_type as SyncEntityType,
      lastError: r.last_error,
      createdAt: r.created_at,
    }));
}

export function retryFailedItems(db: LocalDb, now: number): void {
  db.run(
    `update sync_queue
     set status = 'pending', attempts = 0, next_attempt_at = ?, last_error = null
     where status = 'failed'`,
    [now],
  );
}

/**
 * Make every pending item due immediately by clearing its backoff window.
 * Called on network reconnect / app foreground: the reason a pending item
 * backed off (no connectivity) is now resolved, so a long offline stint
 * shouldn't leave the driver waiting out a multi-minute backoff. Attempt
 * counts are preserved so a genuinely failing item still parks eventually.
 */
export function resetPendingBackoff(db: LocalDb, now: number): void {
  db.run(
    "update sync_queue set next_attempt_at = ? where status = 'pending' and next_attempt_at > ?",
    [now, now],
  );
}
