import { describe, expect, test } from "vitest";
import { getDeliveryStops, mirrorSentDeliveryStop } from "./sync-core";
import { freshDb, NOW, RUN_UUID, seedRun, STOP_UUID } from "./sync-core.test-support";

describe("delivery runs (mirror sent stop)", () => {
  test("mirrorSentDeliveryStop caches an online-saved stop for display", () => {
    const db = freshDb();
    seedRun(db);
    mirrorSentDeliveryStop(
      db,
      {
        clientUuid: STOP_UUID,
        runClientUuid: RUN_UUID,
        customerId: "cust-1",
        customerName: "Raj Motors",
        latitude: 13.0,
        longitude: 80.2,
        invoiceId: "inv-1",
        invoiceNumber: "INV-1",
        photoPaths: ["a.jpg", "b.jpg"],
        serverId: "srv-stop-9",
      },
      NOW + 1000,
    );

    const stops = getDeliveryStops(db, RUN_UUID);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toMatchObject({ customerName: "Raj Motors", invoiceId: "inv-1", photoCount: 2 });

    const row = db.first<{ server_id: string; photos_uploaded: number }>(
      "select server_id, photos_uploaded from delivery_stops where client_uuid = ?",
      [STOP_UUID],
    );
    expect(row?.server_id).toBe("srv-stop-9"); // already synced
    expect(row?.photos_uploaded).toBe(1);
  });

  test("mirrorSentDeliveryStop is idempotent — re-mirroring the same stop replaces, not duplicates", () => {
    const db = freshDb();
    seedRun(db);
    const input = {
      clientUuid: STOP_UUID,
      runClientUuid: RUN_UUID,
      customerId: "cust-1",
      customerName: "Raj Motors",
      latitude: null,
      longitude: null,
      invoiceId: "inv-1",
      invoiceNumber: "INV-1",
      photoPaths: ["a.jpg"],
    };
    mirrorSentDeliveryStop(db, { ...input, serverId: "srv-stop-9" }, NOW);
    mirrorSentDeliveryStop(db, { ...input, serverId: "srv-stop-9" }, NOW + 1);
    expect(getDeliveryStops(db, RUN_UUID)).toHaveLength(1); // replaced, not duplicated
  });
});
