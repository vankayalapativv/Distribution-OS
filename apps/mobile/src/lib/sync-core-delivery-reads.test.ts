import { describe, expect, test } from "vitest";
import { freshDb, NOW, RUN_UUID, STOP_UUID, seedRun } from "./sync-core.test-support";
import { recordDeliveryStop } from "./sync-core-delivery-stop";
import { getActiveDeliveryRun, getDeliveryStops } from "./sync-core-delivery-reads";

describe("getActiveDeliveryRun", () => {
  test("returns null when no run is active", () => {
    expect(getActiveDeliveryRun(freshDb())).toBeNull();
  });

  test("returns the active run mapped to the view model", () => {
    const db = freshDb();
    seedRun(db);
    expect(getActiveDeliveryRun(db)).toMatchObject({
      clientUuid: RUN_UUID,
      vehicleNumber: "TS09AB1234",
      startOdometer: 48210,
      status: "active",
    });
  });
});

describe("getDeliveryStops", () => {
  test("lists a run's stops with a parsed photo count", () => {
    const db = freshDb();
    seedRun(db);
    recordDeliveryStop(
      db,
      {
        clientUuid: STOP_UUID,
        runClientUuid: RUN_UUID,
        customerId: "c1",
        customerName: "Balaji Auto",
        latitude: null,
        longitude: null,
        invoiceId: "inv-1",
        invoiceNumber: "INV-1",
        photoPaths: ["file:///a.jpg", "file:///b.jpg"],
      },
      NOW,
    );
    const stops = getDeliveryStops(db, RUN_UUID);
    expect(stops).toEqual([
      { clientUuid: STOP_UUID, customerName: "Balaji Auto", invoiceId: "inv-1", photoCount: 2, createdAt: NOW },
    ]);
  });

  test("counts zero photos when the stored JSON is malformed", () => {
    const db = freshDb();
    seedRun(db);
    db.run(
      `insert into delivery_stops (client_uuid, run_client_uuid, customer_id, customer_name, photo_paths, created_at)
       values ('s-bad', ?, 'c1', 'X', 'not-json', ?)`,
      [RUN_UUID, NOW],
    );
    expect(getDeliveryStops(db, RUN_UUID)[0].photoCount).toBe(0);
  });
});
