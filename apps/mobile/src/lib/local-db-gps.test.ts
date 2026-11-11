import { describe, expect, test } from "vitest";
import { createTestDb } from "../test/node-sqlite-db";
import { migrateLocalDb } from "./local-db";

describe("v13: GPS point idempotency", () => {
  test("upgrades a legacy GPS table before creating indexes on new columns", () => {
    const db = createTestDb();
    db.exec(`
      create table gps_pings (
        id integer primary key autoincrement,
        latitude real not null,
        longitude real not null,
        accuracy real,
        battery_percentage real,
        recorded_at text not null,
        synced integer not null default 0
      );
      insert into gps_pings (
        latitude,
        longitude,
        accuracy,
        recorded_at
      ) values (12.9716, 77.5946, 10, '2026-07-20T10:00:00.000Z');
      pragma user_version = 12;
    `);

    migrateLocalDb(db);

    const row = db.first<{
      location_point_id: string;
      created_at: number;
      sync_status: string;
    }>(
      "select location_point_id, created_at, sync_status from gps_pings where id = 1",
    );
    expect(row?.location_point_id).toBe("legacy-gps-1");
    expect(row?.created_at).toBeGreaterThan(0);
    expect(row?.sync_status).toBe("pending");

    const indexes = db
      .all<{ name: string }>(
        "select name from sqlite_master where type = 'index' and tbl_name = 'gps_pings'",
      )
      .map((entry) => entry.name);
    expect(indexes).toContain("gps_pings_sync_status");
    expect(indexes).toContain("gps_pings_location_point_id_key");
  });
});
