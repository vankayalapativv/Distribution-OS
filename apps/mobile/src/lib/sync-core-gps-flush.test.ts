import { describe, expect, test, vi } from "vitest";
import { freshDb } from "./sync-core.test-support";
import { MAX_GPS_RETRY_ATTEMPTS } from "./sync-core-gps";
import { flushGpsPings } from "./sync-core-gps-flush";

function seedPing(db: ReturnType<typeof freshDb>, lpid: string, attempts = 0) {
  db.run(
    `insert into gps_pings (location_point_id, latitude, longitude, recorded_at, created_at, synced, sync_status, attempts)
     values (?, 1, 2, '2026-08-05T00:00:00Z', 10, 0, 'pending', ?)`,
    [lpid, attempts],
  );
}
const status = (db: ReturnType<typeof freshDb>, lpid: string) =>
  db.first<{ synced: number; sync_status: string; attempts: number; rejection_reason: string | null }>(
    "select synced, sync_status, attempts, rejection_reason from gps_pings where location_point_id = ?",
    [lpid],
  );

describe("flushGpsPings", () => {
  test("no queued pings → sends nothing", async () => {
    const res = await flushGpsPings(freshDb(), vi.fn());
    expect(res).toEqual({ sent: 0 });
  });

  test("a send failure leaves the pings queued", async () => {
    const db = freshDb();
    seedPing(db, "p1");
    const res = await flushGpsPings(db, vi.fn().mockRejectedValue(new Error("offline")));
    expect(res).toEqual({ sent: 0 });
    expect(status(db, "p1")).toMatchObject({ synced: 0, sync_status: "pending" });
  });

  test("a malformed ack optimistically accepts exactly the sent points", async () => {
    const db = freshDb();
    seedPing(db, "p1");
    seedPing(db, "p2");
    const res = await flushGpsPings(db, vi.fn().mockResolvedValue({ nope: true }));
    expect(res).toEqual({ sent: 2 });
    expect(status(db, "p1")).toMatchObject({ synced: 1, sync_status: "accepted" });
  });

  test("honours per-point accepted / duplicate / rejected acks", async () => {
    const db = freshDb();
    seedPing(db, "a");
    seedPing(db, "b");
    seedPing(db, "c");
    const ack = { results: [
      { locationPointId: "a", status: "accepted" },
      { locationPointId: "b", status: "duplicate" },
      { locationPointId: "c", status: "rejected", reason: "BAD_GEO" },
    ] };
    const res = await flushGpsPings(db, vi.fn().mockResolvedValue(ack));
    expect(res).toEqual({ sent: 2 });
    expect(status(db, "a")).toMatchObject({ synced: 1, sync_status: "accepted" });
    expect(status(db, "b")).toMatchObject({ synced: 1, sync_status: "duplicate" });
    expect(status(db, "c")).toMatchObject({ synced: 0, sync_status: "rejected", rejection_reason: "BAD_GEO" });
  });

  test("retries bump attempts and park at the cap", async () => {
    const db = freshDb();
    seedPing(db, "r1", 0); // → retry
    seedPing(db, "r2", MAX_GPS_RETRY_ATTEMPTS - 1); // → parked 'failed'
    const ack = { results: [
      { locationPointId: "r1", status: "retry" },
      { locationPointId: "r2", status: "retry", reason: "SERVER" },
      { locationPointId: "ghost", status: "retry" }, // not in the batch → attempts default 0
    ] };
    await flushGpsPings(db, vi.fn().mockResolvedValue(ack));
    expect(status(db, "r1")).toMatchObject({ sync_status: "retry", attempts: 1 });
    expect(status(db, "r2")).toMatchObject({ sync_status: "failed", attempts: MAX_GPS_RETRY_ATTEMPTS });
  });

  test("rejected ack without a reason defaults to REJECTED", async () => {
    const db = freshDb();
    seedPing(db, "x");
    await flushGpsPings(db, vi.fn().mockResolvedValue({ results: [{ locationPointId: "x", status: "rejected" }] }));
    expect(status(db, "x")?.rejection_reason).toBe("REJECTED");
  });
});
