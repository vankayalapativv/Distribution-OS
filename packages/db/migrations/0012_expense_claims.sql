-- Phase 1 of Field Expense Claims (docs/FIELD-EXPENSE-ADVANCES-PLAN.md).
--
-- A field-submitted expense CLAIM is an `expenditures` row that is not yet booked:
-- it carries a review lifecycle on top of the existing table. Office-created
-- expenditures (today's flow) are born already-approved, so defaults preserve
-- current behaviour exactly — every existing row becomes status='approved',
-- source='office', and the ledger keeps showing only approved spend.
--
-- RLS already protects `expenditures` (enterprise_isolation); new columns inherit
-- it. No new table, no new grants.

ALTER TABLE public.expenditures
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS submitted_by uuid,          -- the SE/Logistics claimant (field claims)
  ADD COLUMN IF NOT EXISTS claimed_amount numeric(14,2), -- original claimed amount; `amount` holds the APPROVED figure
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid;

-- status ∈ submitted | approved | rejected ; source ∈ office | field.
ALTER TABLE public.expenditures
  DROP CONSTRAINT IF EXISTS expenditures_status_check,
  ADD CONSTRAINT expenditures_status_check
    CHECK (status IN ('submitted', 'approved', 'rejected'));
ALTER TABLE public.expenditures
  DROP CONSTRAINT IF EXISTS expenditures_source_check,
  ADD CONSTRAINT expenditures_source_check
    CHECK (source IN ('office', 'field'));

-- The office claims queue reads pending-first, newest-first, within an enterprise.
CREATE INDEX IF NOT EXISTS expenditures_claims_queue
  ON public.expenditures (status, expenditure_date DESC);

-- A field claim's own submissions, newest-first (the SE's "my claims" list).
CREATE INDEX IF NOT EXISTS expenditures_submitted_by
  ON public.expenditures (submitted_by, created_at DESC);
