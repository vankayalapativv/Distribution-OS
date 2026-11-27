-- Phase 4 of Field Expense Claims (docs/FIELD-EXPENSE-ADVANCES-PLAN.md).
--
-- Payroll-lite: a monthly salary per person, and a monthly "pay salary" record
-- that nets this month's advance recovery (net = salary − recovery). Paying
-- salary books the GROSS amount as a company expenditure (the Salaries category)
-- and reduces the person's outstanding advances; an advance larger than one
-- month's pay recovers what fits and carries the rest forward.
--
-- staff_salaries is EFFECTIVE-DATED (a raise is a new row) — the current salary
-- is the latest row with effective_from <= today. salary_payments is one row per
-- person per month. Tenant-isolated; each needs its own GRANT.

CREATE TABLE IF NOT EXISTS public.staff_salaries (
  enterprise_id uuid NOT NULL DEFAULT public.app_current_enterprise_id(),
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  monthly_amount numeric(14,2) NOT NULL,
  effective_from date NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT staff_salaries_pkey PRIMARY KEY (id),
  CONSTRAINT staff_salaries_amount_check CHECK (monthly_amount > (0)::numeric),
  CONSTRAINT staff_salaries_user_from_unique UNIQUE (user_id, effective_from)
);

CREATE TABLE IF NOT EXISTS public.salary_payments (
  enterprise_id uuid NOT NULL DEFAULT public.app_current_enterprise_id(),
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  period_month date NOT NULL,                  -- first of the month paid
  gross_amount numeric(14,2) NOT NULL,         -- the salary expense booked
  advance_recovered numeric(14,2) NOT NULL DEFAULT 0,
  net_paid numeric(14,2) NOT NULL,             -- gross − advance_recovered (cash out)
  payment_mode text,
  paid_by uuid,
  paid_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT salary_payments_pkey PRIMARY KEY (id),
  CONSTRAINT salary_payments_user_period_unique UNIQUE (user_id, period_month)
);

ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enterprise_isolation ON public.staff_salaries;
CREATE POLICY enterprise_isolation ON public.staff_salaries
  USING (enterprise_id = public.app_current_enterprise_id())
  WITH CHECK (enterprise_id = public.app_current_enterprise_id());

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enterprise_isolation ON public.salary_payments;
CREATE POLICY enterprise_isolation ON public.salary_payments
  USING (enterprise_id = public.app_current_enterprise_id())
  WITH CHECK (enterprise_id = public.app_current_enterprise_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_salaries TO app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_payments TO app_tenant;

CREATE INDEX IF NOT EXISTS staff_salaries_user_from ON public.staff_salaries (user_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS salary_payments_user_period ON public.salary_payments (user_id, period_month DESC);
