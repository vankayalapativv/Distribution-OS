/** Shared sync-queue types, the HTTP error, backoff, and the enqueue helpers. */
import type { LocalDb } from "./local-db";

export type SyncEntityType =
  | "visit_checkin"
  | "visit_checkout"
  | "order"
  | "collection"
  | "delivery_start"
  | "delivery_stop"
  | "delivery_end"
  | "task_done";

export interface SyncQueueItem {
  id: number;
  clientUuid: string;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface SyncTransport {
  /** Sends one queue item to the API; resolves with the response `data`. */
  send(item: SyncQueueItem): Promise<Record<string, unknown> | undefined>;
}

export class SyncHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 300_000;

export function backoffDelayMs(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
}

/** Retryable = the request may succeed later without changing the payload. */
export function isPermanentFailure(error: unknown): boolean {
  if (!(error instanceof SyncHttpError)) return false; // network / unknown → retry
  if (error.status === 401 || error.status === 408 || error.status === 429) {
    return false;
  }
  return error.status >= 400 && error.status < 500;
}

// ── Enqueue helpers (called by the screens) ──────────────────────────────────

export function enqueue(
  db: LocalDb,
  entityType: SyncEntityType,
  clientUuid: string,
  payload: Record<string, unknown>,
  now: number,
): void {
  db.run(
    `insert into sync_queue (client_uuid, entity_type, payload, status, attempts, next_attempt_at, created_at)
     values (?, ?, ?, 'pending', 0, 0, ?)`,
    [clientUuid, entityType, JSON.stringify(payload), now],
  );
}

/** Queue "mark office-assigned task done" (POST /me/tasks/:id/done). Idempotent
 *  server-side, so a replay after a crash is harmless. */
export function enqueueAssignedTaskDone(db: LocalDb, taskId: string, now: number): void {
  enqueue(db, "task_done", taskId, { taskId }, now);
}
