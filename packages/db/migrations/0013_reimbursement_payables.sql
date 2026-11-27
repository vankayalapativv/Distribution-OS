-- Phase 2 of Field Expense Claims (docs/FIELD-EXPENSE-ADVANCES-PLAN.md).
--
-- When a field claim is APPROVED it books as a company expenditure AND creates a
-- payable: money the company now owes the employee. "Approved" ≠ "paid" — the
-- office settles the payable later (cash/UPI/bank), which marks it paid. A
-- person's "company owes you" balance = sum of their still-owed payables.
--
-- One payable per approved claim (unique expenditure_id) so re-approval can't
-- duplicate. Tenant-isolated like every other table; the 0001 grant-on-ALL only
-- covered tables that existed then, so this one needs its own GRANT.

CREATE TABLE IF NOT EXISTS public.reimbursement_payables (
  enterprise_id uuid NOT NULL DEFAULT public.app_current_enterprise_id(),
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  expenditure_id uuid NOT NULL,          -- the approved claim (expenditures.id)
  user_id uuid NOT NULL,                 -- the employee owed
  amount numeric(14,2) NOT NULL,         -- the approved amount
  status text NOT NULL DEFAULT 'owed',   -- owed | paid | reversed
  payment_mode text,                     -- how it was settled (set on pay)
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT reimbursement_payables_pkey PRIMARY KEY (id),
  CONSTRAINT reimbursement_payables_status_check CHECK (status IN ('owed', 'paid', 'reversed')),
  CONSTRAINT reimbursement_payables_amount_check CHECK (amount > (0)::numeric),
  CONSTRAINT reimbursement_payables_expenditure_unique UNIQUE (expenditure_id)
);

ALTER TABLE public.reimbursement_payables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enterprise_isolation ON public.reimbursement_payables;
CREATE POLICY enterprise_isolation ON public.reimbursement_payables
  USING (enterprise_id = public.app_current_enterprise_id())
  WITH CHECK (enterprise_id = public.app_current_enterprise_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reimbursement_payables TO app_tenant;

-- A person's owed balance + the office "to pay" queue, by status.
CREATE INDEX IF NOT EXISTS reimbursement_payables_user_status
  ON public.reimbursement_payables (user_id, status);
