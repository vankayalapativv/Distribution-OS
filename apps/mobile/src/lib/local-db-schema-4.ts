/** Delivery-run mirror, personal reminders, error buffer, assigned-task cache (part 4). */
export const SCHEMA_4 = `
  -- v9: offline-first logistics delivery runs. A run is created locally when
  -- the driver starts (status 'active'), holds freeform stops, and is closed
  -- locally (status 'ended'); the sync queue uploads run→stops→photos in FIFO
  -- order, mapping local client_uuid to server_id as each item syncs.
  create table if not exists delivery_runs (
    client_uuid text primary key,
    server_id text,
    vehicle_number text not null,
    start_odometer real,
    end_odometer real,
    status text not null default 'active',
    run_date text,
    started_at integer not null,
    ended_at integer,
    start_photo_path text,
    start_photo_uploaded integer not null default 0,
    end_photo_path text,
    end_photo_uploaded integer not null default 0
  );

  create table if not exists delivery_stops (
    client_uuid text primary key,
    server_id text,
    run_client_uuid text not null,
    customer_id text not null,
    customer_name text,
    latitude real,
    longitude real,
    invoice_id text,
    invoice_number text,
    photo_paths text not null default '[]',
    photos_uploaded integer not null default 0,
    created_at integer not null
  );
  create index if not exists delivery_stops_run on delivery_stops (run_client_uuid, created_at desc);

  -- v12: personal reminders — local-only (device is the source of truth),
  -- each row mirrors one scheduled OS notification.
  create table if not exists reminders (
    id integer primary key autoincrement,
    title text not null,
    remind_at integer not null,
    customer_id text,
    customer_name text,
    notification_id text,
    status text not null default 'pending',
    created_at integer not null
  );
  create index if not exists reminders_when on reminders (status, remind_at);

  -- Generic key→JSON store. Now backs the error buffer (report-error), which
  -- parks failed error reports here and drains them on reconnect.
  create table if not exists performance_cache (
    id text primary key,
    payload_json text not null,
    cached_at integer not null
  );

  -- v17: office-assigned tasks (from the web) surfaced in the SE Reminders tab.
  -- The server owns these (id = server task id); we cache the fields for offline
  -- display and mirror each one to a scheduled OS notification so it rings at
  -- remind_at even offline. done_synced = 0 marks a done the SE recorded offline
  -- that still needs to be POSTed to the server (survives a reconcile pull).
  create table if not exists assigned_tasks (
    id text primary key,
    title text not null,
    description text,
    priority text not null default 'medium',
    customer_id text,
    customer_name text,
    remind_at integer not null,
    created_by_name text,
    status text not null default 'open',
    notification_id text,
    done_synced integer not null default 1,
    updated_at text,
    cached_at integer not null
  );
  create index if not exists assigned_tasks_when on assigned_tasks (status, remind_at);

  -- v20 (offline read UX): generic read-through cache. Each screen reads a stable
  -- key; cachedFetch writes the latest server payload here (network-first), and the
  -- on-sync bulk prefetch writes the same keys so records work offline even if never
  -- opened. Wiped on logout via ALL_LOCAL_TABLES (shared-device hygiene).
  create table if not exists read_cache (
    key text primary key,
    payload_json text not null,
    cached_at integer not null
  );

  -- delta-sync cursors (key -> server-time ISO string). Lets the heavy bulk
  -- pulls (ledgers, orders) fetch ONLY what changed since the last successful
  -- sync. Cleared on logout so the next user starts with a full cold pull.
  create table if not exists sync_meta (
    key text primary key,
    value text not null
  );

  -- v23 (customer follow-ups): a resolvable commitment captured when the SE
  -- checks out of a no-outcome visit. One OPEN per customer (a newer one
  -- supersedes). Resurfaces at the next check-in + on the customer card; the
  -- ones that carry a follow_up_at feed the Reminders tab. customer_name is a
  -- snapshot so the Reminders list reads right even without the customers cache.
  create table if not exists customer_followups (
    client_uuid text primary key,
    customer_id text not null,
    customer_name text,
    reason text not null,
    follow_up_at text,
    status text not null default 'open',
    created_at integer not null
  );
  create index if not exists customer_followups_open
    on customer_followups (customer_id, status, created_at desc);
`;
