import { describe, expect, it } from "vitest";
import { createTestDb } from "../test/node-sqlite-db";
import { LOCAL_SCHEMA_VERSION } from "./local-db-schema";
import { migrateLocalDb } from "./local-db-migrate";

describe("migrateLocalDb", () => {
  it("creates the schema and stamps the user_version", () => {
    const db = createTestDb();
    migrateLocalDb(db);
    const v = db.first<{ user_version: number }>("pragma user_version");
    expect(v?.user_version).toBe(LOCAL_SCHEMA_VERSION);
    // A representative v21 table exists and is queryable.
    expect(db.all("select 1 from delivery_runs")).toEqual([]);
  });

  it("is idempotent (safe to run on every launch)", () => {
    const db = createTestDb();
    migrateLocalDb(db);
    expect(() => migrateLocalDb(db)).not.toThrow();
  });

  it("backfills idempotency columns on legacy gps rows", () => {
    const db = createTestDb();
    migrateLocalDb(db);
    // A row as an old install left it: empty point id, created_at 0.
    db.run(
      "insert into gps_pings (latitude, longitude, recorded_at, location_point_id, created_at) values (1, 2, 100, '', 0)",
    );
    migrateLocalDb(db); // re-run → backfill
    const row = db.first<{ location_point_id: string; created_at: number }>(
      "select location_point_id, created_at from gps_pings limit 1",
    );
    expect(row?.location_point_id).toMatch(/^legacy-gps-\d+$/);
    expect(row?.created_at).toBeGreaterThan(0);
  });
});
