-- Phase 2a — batch-level inventory foundation.
-- A "lot" is a distinct parcel of stock in one godown (batch + expiry + shelf),
-- with a cached remaining qty (the batch analogue of stock_balances). The ledger
-- (stock_movements) gains batch_id so per-lot on-hand is derivable from it, and
-- transfer/adjust document lines gain batch FKs (used from Phase 2b/2c).
-- Additive only — the deployed Phase-1 API keeps working between migrate + deploy.
-- Invariant upheld by the services: sum(stock_lots.qty_units) == stock_balances.qty_units
-- per (location_id, product_id, pack_size_litres).

BEGIN;

CREATE TABLE IF NOT EXISTS stock_lots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid NOT NULL REFERENCES products(id),
  pack_size_litres numeric NOT NULL,
  brand            text,
  location_id      uuid NOT NULL REFERENCES stock_locations(id),
  batch_number     text,
  expiry_date      date,
  rack_no          text,
  shelf_no         text,
  bin_no           text,
  received_date    date,
  qty_units        numeric NOT NULL DEFAULT 0 CHECK (qty_units >= 0),  -- cached remaining on-hand for THIS lot
  source_type      text,     -- 'grn' | 'opening' | 'transfer' | 'adjustment'
  source_id        uuid,     -- originating document id (null for opening)
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- NULL-safe identity for find-or-create (coalesce so null brand/batch/expiry dedupe).
CREATE UNIQUE INDEX IF NOT EXISTS stock_lots_identity_idx ON stock_lots
  (location_id, product_id, pack_size_litres,
   coalesce(brand, ''), coalesce(batch_number, ''), coalesce(expiry_date, 'infinity'::date));

CREATE INDEX IF NOT EXISTS stock_lots_sku_loc_idx ON stock_lots (location_id, product_id, pack_size_litres);
CREATE INDEX IF NOT EXISTS stock_lots_expiry_idx ON stock_lots (expiry_date) WHERE qty_units > 0;

-- Ledger gains the batch dimension (source of truth for lot on-hand).
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES stock_lots(id);
CREATE INDEX IF NOT EXISTS stock_movements_batch_idx ON stock_movements (batch_id);

-- Document lines record which lot they touched (used from Phase 2b/2c).
ALTER TABLE stock_transfer_items   ADD COLUMN IF NOT EXISTS from_batch_id uuid REFERENCES stock_lots(id);
ALTER TABLE stock_transfer_items   ADD COLUMN IF NOT EXISTS to_batch_id   uuid REFERENCES stock_lots(id);
ALTER TABLE stock_adjustment_items ADD COLUMN IF NOT EXISTS batch_id      uuid REFERENCES stock_lots(id);

COMMIT;
