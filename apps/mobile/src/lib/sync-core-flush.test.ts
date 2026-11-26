import { describe, expect, test, vi } from "vitest";
import { freshDb, NOW } from "./sync-core.test-support";
import { enqueue, SyncHttpError, type SyncQueueItem, type SyncTransport } from "./sync-core-types";
import { flushOnce } from "./sync-core-flush";

function transportOf(fn: (item: SyncQueueItem) => Promise<Record<string, unknown> | undefined>): SyncTransport {
  return { send: vi.fn(fn) };
}
const q = (db: ReturnType<typeof freshDb>) =>
  db.all<{ client_uuid: string; status: string; attempts: number }>("select client_uuid, status, attempts from sync_queue order by id");

describe("flushOnce", () => {
  test("sends due items in order, applies the result and clears the queue", async () => {
    const db = freshDb();
    db.run("insert into orders (client_uuid, customer_id, created_at) values ('o1', 'c', 1)");
    enqueue(db, "order", "o1", {}, NOW);
    const t = transportOf(async () => ({ order: { id: "srv-o1", orderCode: "ORD-1" } }));

    const res = await flushOnce(db, t, NOW);
    expect(res).toEqual({ sent: 1, failed: 0, deferred: 0 });
    expect(q(db)).toHaveLength(0);
    expect(db.first<{ server_id: string }>("select server_id from orders where client_uuid='o1'")?.server_id).toBe("srv-o1");
  });

  test("parks a permanent (4xx) failure and keeps processing later items", async () => {
    const db = freshDb();
    enqueue(db, "task_done", "a", {}, NOW);
    enqueue(db, "task_done", "b", {}, NOW);
    const t = transportOf(async (item) => {
      if (item.clientUuid === "a") throw new SyncHttpError(400, "bad request");
      return undefined;
    });

    const res = await flushOnce(db, t, NOW);
    expect(res).toEqual({ sent: 1, failed: 1, deferred: 0 });
    const rows = q(db);
    expect(rows).toEqual([{ client_uuid: "a", status: "failed", attempts: 0 }]); // b was sent + removed
  });

  test("defers a retryable failure and stops the pass (FIFO causality)", async () => {
    const db = freshDb();
    enqueue(db, "task_done", "a", {}, NOW);
    enqueue(db, "task_done", "b", {}, NOW);
    // A non-Error throw exercises the String(error) message path too.
    const t = transportOf(async () => { throw "network down"; });

    const res = await flushOnce(db, t, NOW);
    expect(res).toEqual({ sent: 0, failed: 0, deferred: 1 });
    const rows = q(db);
    // a deferred (attempts bumped), b never attempted (still pending)
    expect(rows).toEqual([
      { client_uuid: "a", status: "pending", attempts: 1 },
      { client_uuid: "b", status: "pending", attempts: 0 },
    ]);
    expect((t.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});
