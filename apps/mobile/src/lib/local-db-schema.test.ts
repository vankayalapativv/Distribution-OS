import { describe, expect, test } from "vitest";
import { createTestDb } from "../test/node-sqlite-db";
import { LOCAL_SCHEMA_VERSION, migrateLocalDb } from "./local-db";

// v21 re-introduced the offline backbone (reversing the v19 online-required
// cutover): core entities + write-queue + catalogue/history caches, on top of
// the tables kept through the online-required era.
const EXPECTED_TABLES = [
  // Core entities
  "customers",
  "beat_stops",
  "visits",
  "orders",
  "order_items",
  // Collections / invoices / catalogue
  "collections",
  "customer_invoices",
  "products",
  "pack_memory",
  // Credit, write-queue, delta cursors
  "customer_credit",
  "sync_queue",
  "sync_meta",
  // Per-customer history caches
  "cached_orders",
  "cached_collections",
  "customer_detail_cache",
  "cached_ledger",
  "order_detail_cache",
  // Kept through the online-required era
  "gps_pings",
  "delivery_runs",
  "delivery_stops",
  "reminders",
  "performance_cache",
  "assigned_tasks",
  "read_cache",
];

function tableNames(db: ReturnType<typeof createTestDb>): string[] {
  return db
    .all<{ name: string }>("select name from sqlite_master where type = 'table'")
    .map((r) => r.name);
}

describe("local sqlite schema", () => {
  test("migrate creates every expected table", () => {
    const db = createTestDb();
    migrateLocalDb(db);

    const names = tableNames(db);
    for (const table of EXPECTED_TABLES) expect(names).toContain(table);
  });

  test("the products cache carries the Sri Aparajita brand + unit columns", () => {
    const db = createTestDb();
    migrateLocalDb(db);
    const cols = db
      .all<{ name: string }>("pragma table_info(products)")
      .map((r) => r.name);
    expect(cols).toContain("brand");
    expect(cols).toContain("unit");
    expect(cols).toContain("segments");
    expect(cols).toContain("pack_sizes");
  });

  test("migrate stamps the schema version", () => {
    const db = createTestDb();
    migrateLocalDb(db);
    expect(db.first<{ user_version: number }>("pragma user_version")?.user_version).toBe(
      LOCAL_SCHEMA_VERSION,
    );
  });

  test("migrate is idempotent", () => {
    const db = createTestDb();
    migrateLocalDb(db);
    migrateLocalDb(db);
    const row = db.first<{ n: number }>(
      "select count(*) as n from sqlite_master where type = 'table' and name = 'gps_pings'",
    );
    expect(row?.n).toBe(1);
  });

  test("a legacy online-required install gets the offline backbone restored", () => {
    const db = createTestDb();
    // Simulate a v20 online-required install: only the kept tables existed
    // (gps_pings here in its real v20 shape, incl. the sync columns + index).
    db.exec(`
      create table gps_pings (
        id integer primary key autoincrement,
        location_point_id text not null unique,
        client_session_id text,
        latitude real not null,
        longitude real not null,
        accuracy real,
        battery_percentage real,
        recorded_at text not null,
        created_at integer not null,
        sync_status text not null default 'pending',
        rejection_reason text,
        attempts integer not null default 0,
        synced integer not null default 0
      );
      pragma user_version = 20;
    `);

    migrateLocalDb(db);

    const names = tableNames(db);
    // The write-queue + caches are back.
    expect(names).toContain("sync_queue");
    expect(names).toContain("orders");
    expect(names).toContain("products");
    expect(names).toContain("customer_credit");
    // gps data survives.
    expect(names).toContain("gps_pings");
    expect(db.first<{ user_version: number }>("pragma user_version")?.user_version).toBe(
      LOCAL_SCHEMA_VERSION,
    );
  });
});
