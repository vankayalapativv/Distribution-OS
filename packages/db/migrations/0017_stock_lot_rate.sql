-- Phase 2d — per-batch cost.
-- Each stock lot gains its own purchase `rate` so stock can be valued and sales
-- costed per batch (FEFO). The lot-identity index now includes the rate, so the
-- SAME batch + expiry received at a DIFFERENT rate becomes a DISTINCT lot — every
-- parcel keeps the cost it was bought at. Nothing merges that didn't merge before
-- (the key only gains a column), so this is safe on live data.
-- Existing lots are backfilled from their originating GRN / opening document.

BEGIN;

ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS rate numeric(12,4);

-- Backfill GRN lots from the goods-receipt line they came from (matched by the
-- source document + the lot identity columns).
UPDATE stock_lots sl
SET rate = gi.rate
FROM goods_receipt_items gi
WHERE sl.source_type = 'grn'
  AND sl.source_id = gi.grn_id
  AND gi.product_id = sl.product_id
  AND gi.pack_size_litres = sl.pack_size_litres
  AND coalesce(gi.brand, '') = coalesce(sl.brand, '')
  AND coalesce(gi.batch_number, '') = coalesce(sl.batch_number, '')
  AND coalesce(gi.expiry_date, 'infinity'::date) = coalesce(sl.expiry_date, 'infinity'::date)
  AND sl.rate IS NULL
  AND gi.rate IS NOT NULL;

-- Backfill opening lots from the opening-stock line (no source_id for opening,
-- so match on location + identity).
UPDATE stock_lots sl
SET rate = oi.rate
FROM opening_stock_items oi
WHERE sl.source_type = 'opening'
  AND oi.location_id = sl.location_id
  AND oi.product_id = sl.product_id
  AND oi.pack_size_litres = sl.pack_size_litres
  AND coalesce(oi.brand, '') = coalesce(sl.brand, '')
  AND coalesce(oi.batch_number, '') = coalesce(sl.batch_number, '')
  AND coalesce(oi.expiry_date, 'infinity'::date) = coalesce(sl.expiry_date, 'infinity'::date)
  AND sl.rate IS NULL
  AND oi.rate IS NOT NULL;

-- Rebuild the find-or-create identity to include the rate (coalesce(rate,-1) so
-- unpriced/legacy lots still dedupe among themselves).
DROP INDEX IF EXISTS stock_lots_identity_idx;
CREATE UNIQUE INDEX stock_lots_identity_idx ON stock_lots
  (location_id, product_id, pack_size_litres,
   coalesce(brand, ''), coalesce(batch_number, ''), coalesce(expiry_date, 'infinity'::date),
   coalesce(rate, -1));

COMMIT;
