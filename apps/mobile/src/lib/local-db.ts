/**
 * Offline SQLite schema for the Sales Executive app.
 *
 * Pure TypeScript (no React Native imports) so the schema and sync engine can be
 * unit-tested in Node against node:sqlite. At runtime, expo-sqlite is adapted to
 * the same LocalDb interface in src/lib/db.ts. The schema itself lives in
 * local-db-schema*.ts and the migration in local-db-migrate.ts (kept ≤100 lines).
 */

export type SqlValue = string | number | null;

export interface LocalDb {
  exec(sql: string): void;
  run(sql: string, params?: SqlValue[]): void;
  all<T>(sql: string, params?: SqlValue[]): T[];
  first<T>(sql: string, params?: SqlValue[]): T | null;
}

export { LOCAL_SCHEMA_VERSION } from "./local-db-schema";
export { migrateLocalDb } from "./local-db-migrate";

/**
 * Every app-data table in the local SQLite DB. Wiped on logout so the next
 * sign-in on the same device starts clean — no cross-user data leakage.
 * Order does not matter (we DELETE every row from each; FKs are within these).
 */
const ALL_LOCAL_TABLES = [
  // Core entities + write-queue + catalogue/history caches (v21 offline backbone).
  "customers",
  "beat_stops",
  "visits",
  "order_items",
  "orders",
  "collections",
  "customer_invoices",
  "products",
  "pack_memory",
  "customer_credit",
  "sync_queue",
  "sync_meta",
  "cached_orders",
  "cached_collections",
  "customer_detail_cache",
  "order_detail_cache",
  "cached_ledger",
  // Kept through the online-required era.
  "gps_pings",
  "delivery_stops",
  "delivery_runs",
  "reminders",
  "performance_cache",
  "assigned_tasks",
  "read_cache",
  "customer_followups",
] as const;

/**
 * Delete every row from every local table — all offline caches AND any queued
 * writes. Called on logout. Best-effort per table: a table missing on an older
 * install is skipped rather than aborting the wipe.
 */
export function clearAllLocalData(db: LocalDb): void {
  for (const table of ALL_LOCAL_TABLES) {
    try {
      db.run(`delete from ${table}`);
    } catch {
      // Table may not exist yet on an older install — ignore and continue.
    }
  }
}

/**
 * Run `fn` inside a SQLite transaction: a multi-statement local write (an order
 * header + its line items + the sync-queue row) commits atomically, so a
 * mid-write failure can never leave a half-written order that never syncs.
 * Rethrows after rolling back.
 */
export function withTransaction(db: LocalDb, fn: () => void): void {
  db.exec("begin");
  try {
    fn();
    db.exec("commit");
  } catch (e) {
    try {
      db.exec("rollback");
    } catch {
      // ignore rollback failure — surface the original error
    }
    throw e;
  }
}
