/**
 * The full offline SQLite schema, assembled from per-domain parts. Joined into
 * one string run by `migrateLocalDb` via `db.exec` — splitting only happens at
 * statement boundaries, so the executed SQL is identical to one big block.
 */
import { SCHEMA_1 } from "./local-db-schema-1";
import { SCHEMA_2 } from "./local-db-schema-2";
import { SCHEMA_3 } from "./local-db-schema-3";
import { SCHEMA_4 } from "./local-db-schema-4";

// History:
// v19 (2026-09-16): online-required cutover — dropped the write-queue + every
//   read cache. KEPT: gps_pings, delivery_runs/stops, reminders,
//   performance_cache (error buffer), assigned_tasks.
// v20: added the generic `read_cache` table.
// v21 (parity with Beyond): RE-INTRODUCED the offline backbone — core entities
//   (customers, beat_stops, visits, orders, order_items), the write-queue
//   (sync_queue) + delta cursors (sync_meta), the catalogue cache (products with
//   brand+unit, pack_memory), collections + customer_invoices +
//   customer_credit, and the per-customer history caches (cached_orders/
//   collections/ledger, customer_detail_cache, order_detail_cache). These were
//   dropped in v19; Phase 1 of the Sri-Aparajita→Beyond parity restores them.
// v22 (Phase 2c): collections gain latitude/longitude/geocoded_address so the
//   proof photo's stamp geo survives for the offline upload on sync.
export const LOCAL_SCHEMA_VERSION = 23;

export const SCHEMA = [SCHEMA_1, SCHEMA_2, SCHEMA_3, SCHEMA_4].join("\n");
