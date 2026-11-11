/** Core entities (part 1 of the offline SQLite schema — assembled in local-db-schema.ts). */
export const SCHEMA_1 = `
  create table if not exists customers (
    id text primary key,
    customer_code text,
    legal_name text,
    phone text,
    address text,
    address_city text,
    latitude real,
    longitude real,
    updated_at text,
    cached_at integer not null
  );

  create table if not exists beat_stops (
    stop_id text primary key,
    beat_plan_id text,
    plan_date text,
    sequence_no integer,
    stop_status text,
    customer_id text,
    legal_name text,
    contact_phone text,
    address text,
    cached_at integer not null
  );

  create table if not exists visits (
    client_uuid text primary key,
    server_id text,
    beat_plan_stop_id text,
    customer_id text,
    check_in_time text,
    check_in_latitude real,
    check_in_longitude real,
    check_out_time text,
    status text not null default 'checked_in',
    created_at integer not null
  );

  create table if not exists orders (
    client_uuid text primary key,
    server_id text,
    order_code text,
    customer_id text not null,
    order_date text,
    total_litres real,
    created_at integer not null
  );

  -- An order line is an oil: product_id + pack_size_litres + segment.
  create table if not exists order_items (
    id integer primary key autoincrement,
    order_client_uuid text not null references orders(client_uuid),
    product_id text,
    product_name text,
    quantity_units real not null,
    pack_size_litres real,
    segment text
  );
`;
