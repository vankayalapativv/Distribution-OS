-- Optional batch / expiry / storage-location details captured at stock-in (GRN),
-- per received line. All nullable — nothing is required. `expiry_date` drives the
-- advisory "nearing expiry — sell first" report. Stock balances stay per-SKU
-- (not per-batch), so these are informational, not a batch-level ledger.
ALTER TABLE public.goods_receipt_items
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS expiry_date  date,
  ADD COLUMN IF NOT EXISTS rack_no      text,
  ADD COLUMN IF NOT EXISTS shelf_no     text,
  ADD COLUMN IF NOT EXISTS bin_no       text;

-- Speeds up the near-expiry report (lines with an expiry, soonest first).
CREATE INDEX IF NOT EXISTS goods_receipt_items_expiry_date
  ON public.goods_receipt_items (expiry_date)
  WHERE expiry_date IS NOT NULL;
