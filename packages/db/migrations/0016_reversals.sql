-- Phase 5 of Field Expense Claims (docs/FIELD-EXPENSE-ADVANCES-PLAN.md).
--
-- Void / reverse with an audit trail. A booked expenditure (approved claim,
-- general spend, or a salary run) can be reversed instead of hard-deleted:
-- reversed_at / reversed_by already exist on expenditures (migration 0012); this
-- migration gives the salary and reimbursement ledgers the same trail and makes
-- a salary run reversible without losing the advance-recovery it performed.
--
-- A reversed row is kept for audit but drops out of every total (the services
-- filter `reversed_at is null`). A reversed salary payment frees its month so it
-- can be re-run, so "one payment per person per month" now means one LIVE one.
-- Tenant-isolated; the new table needs its own GRANT (0001's grant-on-ALL
-- predates it).

-- Exactly how much each advance gave to a salary payment, captured at pay time,
-- so reversing that payment restores each advance precisely (outstanding +
-- status) instead of guessing how the recovered total was split.
CREATE TABLE IF NOT EXISTS public.salary_payment_recoveries (
  enterprise_id uuid NOT NULL DEFAULT public.app_current_enterprise_id(),
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  salary_payment_id uuid NOT NULL,
  advance_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL,              -- recovered from this advance this run
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT salary_payment_recoveries_pkey PRIMARY KEY (id),
  CONSTRAINT salary_payment_recoveries_amount_check CHECK (amount > (0)::numeric)
);

ALTER TABLE public.salary_payment_recoveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enterprise_isolation ON public.salary_payment_recoveries;
CREATE POLICY enterprise_isolation ON public.salary_payment_recoveries
  USING (enterprise_id = public.app_current_enterprise_id())
  WITH CHECK (enterprise_id = public.app_current_enterprise_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_payment_recoveries TO app_tenant;

CREATE INDEX IF NOT EXISTS salary_payment_recoveries_payment
  ON public.salary_payment_recoveries (salary_payment_id);

-- Salary payments: link the expenditure the run booked (so a reversal can reverse
-- it) + a reversal trail. A reversed payment frees its month for a re-run, so the
-- "one per month" rule becomes "one LIVE per month" via a partial unique index.
ALTER TABLE public.salary_payments
  ADD COLUMN IF NOT EXISTS expenditure_id uuid,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid;

ALTER TABLE public.salary_payments
  DROP CONSTRAINT IF EXISTS salary_payments_user_period_unique;

CREATE UNIQUE INDEX IF NOT EXISTS salary_payments_user_period_live
  ON public.salary_payments (user_id, period_month)
  WHERE reversed_at IS NULL;

-- Reimbursement payables already carry a 'reversed' status (migration 0013);
-- give them the who/when trail to match.
ALTER TABLE public.reimbursement_payables
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid;
