/** Collections, invoices, GPS, catalogue caches (part 2 of the offline schema). */
export const SCHEMA_2 = `
  create table if not exists collections (
    client_uuid text primary key,
    server_id text,
    collection_code text,
    customer_id text not null,
    collection_date text not null,
    payment_mode text not null,
    collection_type text not null default 'general',
    collection_amount real not null,
    payment_reference_number text,
    invoice_id text,
    cheque_date text,
    bank_name text,
    accountant_approval_status text,
    proof_photo_path text,
    proof_uploaded integer not null default 0,
    latitude real,
    longitude real,
    geocoded_address text,
    created_at integer not null
  );

  -- outstanding-invoices cache per customer (collection flow)
  create table if not exists customer_invoices (
    id text primary key,
    customer_id text not null,
    invoice_number text not null,
    invoice_date text,
    due_date text,
    net_invoice_value real not null default 0,
    amount_collected real not null default 0,
    outstanding_amount real not null default 0,
    payment_status text,
    days_overdue integer not null default 0,
    cached_at integer not null
  );
  create index if not exists customer_invoices_customer on customer_invoices (customer_id, days_overdue desc);

  -- GPS ping buffer — the one local-persistence that was kept through the
  -- online-required era; live tracking survives dead zones.
  create table if not exists gps_pings (
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
  create index if not exists gps_pings_unsynced on gps_pings (synced, id);

  -- Oil catalogue cache for offline order creation. Sri Aparajita products carry
  -- a brand (Fuchs / Savsol / MFC — the order screen's top tabs) and a unit
  -- ("litres" = pick a pack size, "quantity" = pieces), on top of segments +
  -- pack sizes. This CACHES the existing catalogue; it does not change the model.
  create table if not exists products (
    id text primary key,
    product_name text not null,
    brand text,
    unit text not null default 'litres',
    segments text not null default '[]',
    pack_sizes text not null default '[]',
    cached_at integer not null
  );

  -- Last-used pack size per product (order-sheet pre-selection).
  create table if not exists pack_memory (
    product_id text primary key,
    pack_size real not null,
    updated_at integer not null
  );
`;
