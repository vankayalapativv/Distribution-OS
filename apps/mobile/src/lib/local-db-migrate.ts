import type { LocalDb } from "./local-db";
import { LOCAL_SCHEMA_VERSION, SCHEMA } from "./local-db-schema";

export function migrateLocalDb(db: LocalDb): void {
  // Deliberately NO early-return on user_version: every step below is
  // idempotent (create-if-not-exists + try-alter), and running them on each
  // launch makes the migration immune to partially-applied states.
  db.exec(SCHEMA);

  // Column additions for databases created before a column existed. SQLite has
  // no "add column if not exists"; a duplicate-column error just means it's
  // current. Mostly defensive — the v21 re-introduction creates these tables
  // fresh with their full column set (they were dropped in the v19 cutover), so
  // these only matter if a table somehow survived from an earlier shape.
  const alters = [
    "alter table products add column brand text",
    "alter table products add column unit text not null default 'litres'",
    "alter table customers add column latitude real",
    "alter table customers add column longitude real",
    "alter table customer_credit add column advance_credit real not null default 0",
    "alter table collections add column collection_type text not null default 'general'",
    "alter table collections add column proof_photo_path text",
    "alter table collections add column proof_uploaded integer not null default 0",
    "alter table collections add column latitude real",
    "alter table collections add column longitude real",
    "alter table collections add column geocoded_address text",
    "alter table gps_pings add column location_point_id text",
    "alter table gps_pings add column client_session_id text",
    "alter table gps_pings add column created_at integer not null default 0",
    "alter table gps_pings add column sync_status text not null default 'pending'",
    "alter table gps_pings add column rejection_reason text",
    "alter table gps_pings add column attempts integer not null default 0",
    "alter table delivery_stops add column invoice_id text",
    "alter table delivery_stops add column invoice_number text",
  ];
  for (const statement of alters) {
    try {
      db.exec(statement);
    } catch {
      // duplicate column — already present
    }
  }

  // Backfill the gps_pings idempotency columns for rows created before them.
  const legacyGpsRows = db.all<{ id: number; location_point_id: string | null; created_at: number | null }>(
    "select id, location_point_id, created_at from gps_pings where location_point_id is null or location_point_id = '' or created_at = 0",
  );
  for (const row of legacyGpsRows) {
    db.run(
      "update gps_pings set location_point_id = coalesce(nullif(location_point_id, ''), ?), created_at = case when created_at = 0 then ? else created_at end where id = ?",
      [`legacy-gps-${row.id}`, Date.now(), row.id],
    );
  }
  db.exec("create unique index if not exists gps_pings_location_point_id_key on gps_pings (location_point_id)");
  db.exec("create index if not exists gps_pings_sync_status on gps_pings (sync_status, id)");

  db.exec(`pragma user_version = ${LOCAL_SCHEMA_VERSION}`);
}
