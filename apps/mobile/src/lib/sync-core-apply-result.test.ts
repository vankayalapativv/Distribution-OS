import { describe, expect, test } from "vitest";
import { freshDb, NOW, RUN_UUID, STOP_UUID, seedRun } from "./sync-core.test-support";
import { recordDeliveryStop } from "./sync-core-delivery-stop";
import { applyServerResult } from "./sync-core-apply-result";
import type { SyncQueueItem, SyncEntityType } from "./sync-core-types";

function item(entityType: SyncEntityType, clientUuid: string): SyncQueueItem {
  return { id: 1, clientUuid, entityType, payload: {}, attempts: 0 };
}
const DB = () => freshDb();

describe("applyServerResult", () => {
  test("is a no-op without response data", () => {
    const db = DB();
    db.run("insert into visits (client_uuid, created_at) values ('v1', 1)");
    applyServerResult(db, item("visit_checkin", "v1"), undefined);
    expect(db.first<{ server_id: string | null }>("select server_id from visits where client_uuid='v1'")?.server_id).toBeNull();
  });

  test("visit_checkin maps the visit server id (and ignores a missing id)", () => {
    const db = DB();
    db.run("insert into visits (client_uuid, created_at) values ('v1', 1)");
    applyServerResult(db, item("visit_checkin", "v1"), { visitId: "srv-v1" });
    expect(db.first<{ server_id: string }>("select server_id from visits where client_uuid='v1'")?.server_id).toBe("srv-v1");
    applyServerResult(db, item("visit_checkin", "v1"), {});
    expect(db.first<{ server_id: string }>("select server_id from visits where client_uuid='v1'")?.server_id).toBe("srv-v1");
  });

  test("visit_checkout marks the visit completed", () => {
    const db = DB();
    db.run("insert into visits (client_uuid, created_at) values ('v1', 1)");
    applyServerResult(db, item("visit_checkout", "v1"), { ok: true });
    expect(db.first<{ status: string }>("select status from visits where client_uuid='v1'")?.status).toBe("completed");
  });

  test("order maps server id + order code", () => {
    const db = DB();
    db.run("insert into orders (client_uuid, customer_id, created_at) values ('o1', 'cust', 1)");
    applyServerResult(db, item("order", "o1"), { order: { id: "srv-o1", orderCode: "ORD-1" } });
    const row = db.first<{ server_id: string; order_code: string }>("select server_id, order_code from orders where client_uuid='o1'");
    expect(row).toMatchObject({ server_id: "srv-o1", order_code: "ORD-1" });
    applyServerResult(db, item("order", "o1"), {}); // no order.id → no change
    expect(db.first<{ server_id: string }>("select server_id from orders where client_uuid='o1'")?.server_id).toBe("srv-o1");
  });

  test("collection maps server id + collection code", () => {
    const db = DB();
    db.run("insert into collections (client_uuid, customer_id, collection_date, payment_mode, collection_amount, created_at) values ('c1', 'cust', '2026-08-05', 'cash', 100, 1)");
    applyServerResult(db, item("collection", "c1"), { id: "srv-c1", collectionCode: "COLL-1" });
    const row = db.first<{ server_id: string; collection_code: string }>("select server_id, collection_code from collections where client_uuid='c1'");
    expect(row).toMatchObject({ server_id: "srv-c1", collection_code: "COLL-1" });
    applyServerResult(db, item("collection", "c1"), {}); // no id → no change
    expect(db.first<{ server_id: string }>("select server_id from collections where client_uuid='c1'")?.server_id).toBe("srv-c1");
  });

  test("delivery_start maps the run server id", () => {
    const db = DB();
    seedRun(db);
    applyServerResult(db, item("delivery_start", RUN_UUID), { id: "new-run-srv" });
    expect(db.first<{ server_id: string }>("select server_id from delivery_runs where client_uuid=?", [RUN_UUID])?.server_id).toBe("new-run-srv");
    applyServerResult(db, item("delivery_start", RUN_UUID), {}); // no id → unchanged
    expect(db.first<{ server_id: string }>("select server_id from delivery_runs where client_uuid=?", [RUN_UUID])?.server_id).toBe("new-run-srv");
  });

  test("delivery_stop maps the stop server id", () => {
    const db = DB();
    seedRun(db);
    recordDeliveryStop(db, { clientUuid: STOP_UUID, runClientUuid: RUN_UUID, customerId: "c", customerName: null, latitude: null, longitude: null, invoiceId: null, invoiceNumber: null, photoPaths: [] }, NOW);
    applyServerResult(db, item("delivery_stop", STOP_UUID), { id: "srv-stop" });
    expect(db.first<{ server_id: string }>("select server_id from delivery_stops where client_uuid=?", [STOP_UUID])?.server_id).toBe("srv-stop");
  });

  test("delivery_end is a no-op (run already carries its id)", () => {
    const db = DB();
    seedRun(db);
    expect(() => applyServerResult(db, item("delivery_end", RUN_UUID), { ok: true })).not.toThrow();
  });
});
