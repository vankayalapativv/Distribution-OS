-- 0020_stock_return_movement_kind.sql
-- Allow a 'return' stock movement so a Sales Return restocks the lot(s) the sale
-- drew from (reverse-FEFO, same batch/expiry/rate, into the invoice's godown).
-- Pure constraint widening: no data change, instant, reversible.

ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_kind_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_kind_check CHECK (
  kind IN ('opening', 'grn', 'sale', 'sale_reversal', 'transfer_in', 'transfer_out', 'adjustment', 'return')
);
