-- Phase 2e — cost of goods sold per invoice line.
-- When a generated invoice deducts stock FEFO across lots, we now record the cost
-- of the units sold (Σ qty × the drawn lot's rate) on the line. NULL when any lot
-- the line drew from was unpriced (cost can't be stated), so margin reports can
-- tell "no margin" apart from "zero cost". Uploaded (non-generated) invoices leave
-- it NULL — they carry no stock lots.
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS cogs_amount numeric(14,2);
