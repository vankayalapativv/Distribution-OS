import { createTestDb } from "../test/node-sqlite-db";
import { migrateLocalDb } from "./local-db";
import { mirrorStartedDeliveryRun } from "./sync-core";

export const NOW = 1_800_000_000_000; // fixed epoch ms
export const RUN_UUID = "20000000-0000-4000-8000-000000000001";
export const RUN_SERVER_ID = "srv-run-1";
export const STOP_UUID = "20000000-0000-4000-8000-000000000002";

export function freshDb() {
  const db = createTestDb();
  migrateLocalDb(db);
  return db;
}

/** Seed an active delivery run as the online path leaves it: mirrored locally
 *  with its server id (no queue). */
export function seedRun(db: ReturnType<typeof freshDb>) {
  mirrorStartedDeliveryRun(
    db,
    {
      clientUuid: RUN_UUID,
      serverId: RUN_SERVER_ID,
      vehicleNumber: "TS09AB1234",
      startOdometer: 48210,
      runDate: "2026-07-15",
      startPhotoPath: "file:///start.jpg",
    },
    NOW,
  );
}
