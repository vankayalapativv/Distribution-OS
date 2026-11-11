import { describe, expect, test } from "vitest";
import { freshDb, NOW } from "../sync-core.test-support";
import { flushOnce, getQueueStats, type SyncTransport } from "../sync-core";
import { ensureCheckoutQueued, recordVisitCheckin } from "./visit-queue";

const CUST = "cust-1";
const CHECKIN_UUID = "aaaaaaaa-0000-4000-8000-000000000001";

/** Transport: a check-in gets a server visit id; everything else succeeds empty. */
const transport: SyncTransport = {
  async send(item) {
    if (item.entityType === "visit_checkin") return { visitId: "srv-visit-1" };
    return {};
  },
};

describe("offline visit check-in / check-out queue", () => {
  test("recordVisitCheckin writes a local visit row and queues the check-in", () => {
    const db = freshDb();
    recordVisitCheckin(db, { clientUuid: CHECKIN_UUID, customerId: CUST, latitude: 17.4, longitude: 78.5 }, NOW);

    const visit = db.first<{ status: string; server_id: string | null }>(
      "select status, server_id from visits where client_uuid = ?",
      [CHECKIN_UUID],
    );
    expect(visit?.status).toBe("checked_in");
    expect(visit?.server_id).toBeNull();
    expect(getQueueStats(db)).toEqual({ pending: 1, failed: 0 });
  });

  test("flushing a check-in maps the server visit id onto the local row", async () => {
    const db = freshDb();
    recordVisitCheckin(db, { clientUuid: CHECKIN_UUID, customerId: CUST, latitude: 17.4, longitude: 78.5 }, NOW);
    const res = await flushOnce(db, transport, NOW);
    expect(res.sent).toBe(1);
    const visit = db.first<{ server_id: string | null }>(
      "select server_id from visits where client_uuid = ?",
      [CHECKIN_UUID],
    );
    expect(visit?.server_id).toBe("srv-visit-1");
    expect(getQueueStats(db)).toEqual({ pending: 0, failed: 0 });
  });

  test("check-in → sync → check-out flows FIFO and clears the queue", async () => {
    const db = freshDb();
    // 1. Offline check-in.
    recordVisitCheckin(db, { clientUuid: CHECKIN_UUID, customerId: CUST, latitude: 17.4, longitude: 78.5 }, NOW);
    await flushOnce(db, transport, NOW); // check-in syncs → server_id set

    // 2. Offline check-out with a no-outcome reason (server id already known).
    ensureCheckoutQueued(
      db,
      { clientUuid: CHECKIN_UUID, serverId: "srv-visit-1", customerId: CUST, latitude: 17.4, longitude: 78.5, noOutcomeReason: "shop closed" },
      NOW + 1000,
    );
    const visit = db.first<{ status: string; check_out_time: string | null }>(
      "select status, check_out_time from visits where client_uuid = ?",
      [CHECKIN_UUID],
    );
    expect(visit?.status).toBe("completed");
    expect(visit?.check_out_time).toBeTruthy();
    expect(getQueueStats(db)).toEqual({ pending: 1, failed: 0 });

    // 3. Check-out syncs.
    const res = await flushOnce(db, transport, NOW + 1000);
    expect(res.sent).toBe(1);
    expect(getQueueStats(db)).toEqual({ pending: 0, failed: 0 });
  });

  test("a check-out for a header-only visit seeds a local row with the server id", () => {
    const db = freshDb();
    // No prior local row (visit checked in on a synced day, app reopened).
    ensureCheckoutQueued(
      db,
      { clientUuid: "srv-visit-9", serverId: "srv-visit-9", customerId: CUST, latitude: 1, longitude: 2 },
      NOW,
    );
    const visit = db.first<{ server_id: string | null; status: string }>(
      "select server_id, status from visits where client_uuid = ?",
      ["srv-visit-9"],
    );
    expect(visit?.server_id).toBe("srv-visit-9");
    expect(visit?.status).toBe("completed");
    expect(getQueueStats(db)).toEqual({ pending: 1, failed: 0 });
  });
});
