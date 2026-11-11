-- Opening stock can now carry a per-line rate (optional), so go-live stock has a
-- value, mirroring goods_receipt_items. `amount` = rate × qty_units (stored for
-- convenience / valuation), both nullable since opening stock may be unpriced.
ALTER TABLE public.opening_stock_items ADD COLUMN IF NOT EXISTS rate numeric(12,4);
ALTER TABLE public.opening_stock_items ADD COLUMN IF NOT EXISTS amount numeric(14,2);
