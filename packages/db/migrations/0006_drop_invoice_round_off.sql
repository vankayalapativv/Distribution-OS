-- 0006 — drop the invoice round-off.
--
-- Generated invoices no longer round the grand total to the rupee: the net value
-- is exactly taxable + GST (paise kept). The `round_off` column is therefore dead
-- and removed. `invoice_net_value` continues to hold the grand total.
--
-- Safe: IF EXISTS, and nothing reads round_off after this migration.

ALTER TABLE public.invoices DROP COLUMN IF EXISTS round_off;
