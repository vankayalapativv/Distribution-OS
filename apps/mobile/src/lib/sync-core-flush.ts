/** FIFO queue flush: send due items in order, park permanents, stop on retryable. */
import type { LocalDb } from "./local-db";
import { applyServerResult } from "./sync-core-apply-result";
import { getDueItems } from "./sync-core-queue";
import { backoffDelayMs, isPermanentFailure, type SyncTransport } from "./sync-core-types";

export interface FlushResult {
  sent: number;
  failed: number;
  deferred: number;
}

export async function flushOnce(
  db: LocalDb,
  transport: SyncTransport,
  now: number,
): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failed: 0, deferred: 0 };

  for (const item of getDueItems(db, now)) {
    try {
      const data = await transport.send(item);
      applyServerResult(db, item, data);
      db.run("delete from sync_queue where id = ?", [item.id]);
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isPermanentFailure(error)) {
        db.run(
          "update sync_queue set status = 'failed', last_error = ? where id = ?",
          [message, item.id],
        );
        result.failed += 1;
        continue; // later items are independent of a rejected payload
      }
      db.run(
        "update sync_queue set attempts = attempts + 1, next_attempt_at = ?, last_error = ? where id = ?",
        [now + backoffDelayMs(item.attempts), message, item.id],
      );
      result.deferred += 1;
      break; // retryable → stop the flush to preserve FIFO causality
    }
  }

  return result;
}
