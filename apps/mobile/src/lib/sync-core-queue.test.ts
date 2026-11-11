import { describe, expect, test } from "vitest";
import { freshDb, NOW } from "./sync-core.test-support";
import {
  enqueue,
  SyncHttpError,
  type SyncQueueItem,
  type SyncTransport,
  backoffDelayMs,
  isPermanentFailure,
} from "./sync-core-types";
import {
  getDueItems,
  getFailedItems,
  getQueueStats,
  resetPendingBackoff,
  retryFailedItems,
} from "./sync-core-queue";
import { flushOnce } from "./sync-core-flush";

/** A transport scripted per entity id via the client_uuid → outcome map. */
function transportOf(
  script: (item: SyncQueueItem) => "ok" | "retry" | "permanent",
): SyncTransport {
  return {
    async send(item) {
      const outcome = script(item);
      if (outcome === "ok") return { id: `srv-${item.clientUuid}` };
      if (outcome === "permanent") throw new SyncHttpError(422, "bad payload");
      throw new SyncHttpError(503, "server busy"); // retryable
    },
  };
}

describe("sync-core write-queue engine", () => {
  test("enqueue → getDueItems returns pending items in FIFO order", () => {
    const db = freshDb();
    enqueue(db, "order", "uuid-a", { n: 1 }, NOW);
    enqueue(db, "collection", "uuid-b", { n: 2 }, NOW);
    const due = getDueItems(db, NOW);
    expect(due.map((d) => d.clientUuid)).toEqual(["uuid-a", "uuid-b"]);
    expect(due[0]?.entityType).toBe("order");
    expect(due[0]?.payload).toEqual({ n: 1 });
  });

  test("a future next_attempt_at is not yet due", () => {
    const db = freshDb();
    enqueue(db, "order", "uuid-a", {}, NOW);
    db.run("update sync_queue set next_attempt_at = ? where client_uuid = 'uuid-a'", [NOW + 10_000]);
    expect(getDueItems(db, NOW)).toHaveLength(0);
    expect(getDueItems(db, NOW + 10_000)).toHaveLength(1);
  });

  test("flushOnce sends all items and clears the queue on success", async () => {
    const db = freshDb();
    enqueue(db, "order", "uuid-a", {}, NOW);
    enqueue(db, "collection", "uuid-b", {}, NOW);
    const res = await flushOnce(db, transportOf(() => "ok"), NOW);
    expect(res).toEqual({ sent: 2, failed: 0, deferred: 0 });
    expect(getQueueStats(db)).toEqual({ pending: 0, failed: 0 });
  });

  test("a permanent failure parks the item and later items continue", async () => {
    const db = freshDb();
    enqueue(db, "order", "bad", {}, NOW);
    enqueue(db, "order", "good", {}, NOW);
    const res = await flushOnce(
      db,
      transportOf((i) => (i.clientUuid === "bad" ? "permanent" : "ok")),
      NOW,
    );
    expect(res).toEqual({ sent: 1, failed: 1, deferred: 0 });
    const failed = getFailedItems(db);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.lastError).toContain("bad payload");
    expect(getQueueStats(db)).toEqual({ pending: 0, failed: 1 });
  });

  test("a retryable failure backs off and STOPS the flush (FIFO causality)", async () => {
    const db = freshDb();
    enqueue(db, "visit_checkin", "first", {}, NOW);
    enqueue(db, "order", "second", {}, NOW);
    const res = await flushOnce(db, transportOf(() => "retry"), NOW);
    expect(res).toEqual({ sent: 0, failed: 0, deferred: 1 });
    // Both remain pending; the first backed off, the second was never attempted.
    expect(getQueueStats(db)).toEqual({ pending: 2, failed: 0 });
    const row = db.first<{ attempts: number; next_attempt_at: number }>(
      "select attempts, next_attempt_at from sync_queue where client_uuid = 'first'",
    );
    expect(row?.attempts).toBe(1);
    expect(row?.next_attempt_at).toBe(NOW + backoffDelayMs(0));
  });

  test("retryFailedItems requeues failed items; resetPendingBackoff makes them due", async () => {
    const db = freshDb();
    enqueue(db, "order", "bad", {}, NOW);
    await flushOnce(db, transportOf(() => "permanent"), NOW);
    expect(getQueueStats(db)).toEqual({ pending: 0, failed: 1 });
    retryFailedItems(db, NOW);
    expect(getQueueStats(db)).toEqual({ pending: 1, failed: 0 });

    db.run("update sync_queue set next_attempt_at = ? where client_uuid = 'bad'", [NOW + 999_999]);
    expect(getDueItems(db, NOW)).toHaveLength(0);
    resetPendingBackoff(db, NOW);
    expect(getDueItems(db, NOW)).toHaveLength(1);
  });

  test("backoff grows and caps; permanent-failure classification", () => {
    expect(backoffDelayMs(0)).toBe(5_000);
    expect(backoffDelayMs(1)).toBe(10_000);
    expect(backoffDelayMs(99)).toBe(300_000); // capped
    expect(isPermanentFailure(new SyncHttpError(422, "x"))).toBe(true);
    expect(isPermanentFailure(new SyncHttpError(401, "x"))).toBe(false); // transient
    expect(isPermanentFailure(new SyncHttpError(503, "x"))).toBe(false);
    expect(isPermanentFailure(new Error("network"))).toBe(false);
  });
});
