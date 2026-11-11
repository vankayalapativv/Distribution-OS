/**
 * Durable offline buffer for error reports, kept pure (deps injected) so it can
 * be unit-tested in node the way online-first.ts / sync-core.ts are. It parks
 * reports that can't be sent (offline, or a failed POST) in the shared
 * `performance_cache` SQLite table and drains them on reconnect.
 *
 * report-error.ts wires the real LocalDb + POST function to these.
 */
import type { LocalDb } from "./local-db";

const BUFFER_KEY = "__pending_error_reports";
export const MAX_BUFFER = 50;

/** Read the buffered reports. Absent row or unparseable payload → empty (never throws). */
export function readErrorBuffer<T = unknown>(db: LocalDb | null): T[] {
  try {
    const row = db?.first<{ payload_json: string }>(
      "select payload_json from performance_cache where id = ?",
      [BUFFER_KEY],
    );
    return row ? (JSON.parse(row.payload_json) as T[]) : [];
  } catch {
    return [];
  }
}

/** Persist the buffer (upsert). No-op when storage is unavailable — reporting must never throw. */
export function writeErrorBuffer(db: LocalDb | null, items: unknown[]): void {
  try {
    db?.run(
      `insert into performance_cache (id, payload_json, cached_at) values (?, ?, ?)
       on conflict (id) do update set payload_json = excluded.payload_json, cached_at = excluded.cached_at`,
      [BUFFER_KEY, JSON.stringify(items), Date.now()],
    );
  } catch {
    // storage unavailable — drop silently
  }
}

/** Append one report, keeping only the most recent MAX_BUFFER (ring buffer). */
export function enqueueError(db: LocalDb | null, payload: unknown): void {
  writeErrorBuffer(db, [...readErrorBuffer(db), payload].slice(-MAX_BUFFER));
}

/**
 * Send every buffered report via `post`, KEEPING the ones that still fail (so a
 * mid-flush network flap doesn't drop them). Items are re-persisted after the run.
 */
export async function flushErrorBuffer<T>(
  db: LocalDb | null,
  post: (item: T) => Promise<boolean>,
): Promise<void> {
  const items = readErrorBuffer<T>(db);
  if (items.length === 0) return;
  const remaining: T[] = [];
  for (const item of items) {
    if (!(await post(item))) remaining.push(item);
  }
  writeErrorBuffer(db, remaining);
}
