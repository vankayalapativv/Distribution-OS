/** Credit gate, sync queue, and the per-customer history caches (part 3). */
export const SCHEMA_3 = `
  -- credit-gate cache per customer (server-computed creditBlocked)
  create table if not exists customer_credit (
    customer_id text primary key,
    credit_blocked integer not null,
    total_outstanding real not null,
    advance_credit real not null default 0,
    credit_overdue_days integer not null,
    cached_at integer not null
  );

  create table if not exists sync_queue (
    id integer primary key autoincrement,
    client_uuid text not null,
    entity_type text not null,
    payload text not null,
    status text not null default 'pending',
    attempts integer not null default 0,
    next_attempt_at integer not null default 0,
    last_error text,
    created_at integer not null
  );
  create index if not exists sync_queue_due on sync_queue (status, next_attempt_at, id);

  -- server sales/collections history cache per customer, so the customer detail
  -- screen shows Last-5 sales & collections offline for every customer the SE
  -- added (prefetched on sync).
  create table if not exists cached_orders (
    id text primary key,
    customer_id text not null,
    order_code text,
    order_date text,
    total_litres real,
    order_status text,
    fulfillment_status text,
    cached_at integer not null
  );
  create index if not exists cached_orders_customer on cached_orders (customer_id, order_date desc);

  create table if not exists cached_collections (
    id text primary key,
    customer_id text not null,
    collection_code text,
    collection_date text,
    collection_amount real,
    payment_mode text,
    accountant_approval_status text,
    cached_at integer not null
  );
  create index if not exists cached_collections_customer on cached_collections (customer_id, collection_date desc);

  create table if not exists customer_detail_cache (
    id text primary key,
    detail_json text not null,
    cached_at integer not null
  );

  -- per-customer ledger statement cache (customer + range key -> full ledger
  -- JSON) so the SE ledger screen renders offline.
  create table if not exists cached_ledger (
    customer_id text not null,
    range_key text not null,
    ledger_json text not null,
    cached_at integer not null,
    primary key (customer_id, range_key)
  );

  -- order-detail sheet cache (server order id → full detail JSON) so a
  -- once-viewed order reopens offline.
  create table if not exists order_detail_cache (
    id text primary key,
    detail_json text not null,
    cached_at integer not null
  );
`;
