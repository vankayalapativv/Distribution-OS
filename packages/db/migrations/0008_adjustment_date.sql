-- 0008_adjustment_date.sql
--
-- Stock Journal #1 (date field). GRN (received_date) and transfers (transfer_date)
-- already carry a business date; adjustments only had created_at. Add an explicit
-- adjustment_date so an adjustment can be back-dated and the Adjustments tab shows
-- the business date (not the system timestamp). Opening stock has no document —
-- its back-date rides on the ledger movement's moved_at.
--
-- Additive + idempotent. Backfills existing rows from created_at (IST calendar day).

ALTER TABLE public.stock_adjustments
  ADD COLUMN IF NOT EXISTS adjustment_date date;

UPDATE public.stock_adjustments
  SET adjustment_date = (created_at AT TIME ZONE 'Asia/Kolkata')::date
  WHERE adjustment_date IS NULL;

ALTER TABLE public.stock_adjustments
  ALTER COLUMN adjustment_date SET DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date;

ALTER TABLE public.stock_adjustments
  ALTER COLUMN adjustment_date SET NOT NULL;
