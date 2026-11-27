-- Phase 3 of Field Expense Claims (docs/FIELD-EXPENSE-ADVANCES-PLAN.md).
--
-- A salary advance: cash given to a field/office person ahead of salary. It is a
-- RECEIVABLE (money they owe back), NOT an expense — recovered from their salary
-- later (Phase 4). An SE can REQUEST one on mobile (office approves), or the
-- office RECORDS one directly. Recovery is chosen per advance: the whole amount
-- from the next salary, or in monthly installments.
--
-- status:  requested → active → cleared        (or requested → rejected)
--   requested: SE asked, awaiting office        (outstanding 0 until disbursed)
--   active:    disbursed; outstanding = amount, reduced as salary recovers it
--   cleared:   fully recovered (outstanding 0)
--   rejected:  office declined the request
-- Tenant-isolated; needs its own GRANT (0001's grant-on-ALL predates this table).

CREATE TABLE IF NOT EXISTS public.advances (
  enterprise_id uuid NOT NULL DEFAULT public.app_current_enterprise_id(),
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,                       -- who the advance is for
  amount numeric(14,2) NOT NULL,
  source text NOT NULL,                        -- request | direct
  status text NOT NULL DEFAULT 'requested',    -- requested | active | rejected | cleared
  recovery_plan text,                          -- full_next | installment (set on activation)
  installment_amount numeric(14,2),            -- ₹/month for the installment plan
  outstanding numeric(14,2) NOT NULL DEFAULT 0,-- amount still to recover (0 until active)
  reason text,                                 -- the requester's reason (optional)
  requested_by uuid,                           -- the SE (request) or the office recorder (direct)
  approved_by uuid,                            -- the office approver/recorder
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT advances_pkey PRIMARY KEY (id),
  CONSTRAINT advances_amount_check CHECK (amount > (0)::numeric),
  CONSTRAINT advances_source_check CHECK (source IN ('request', 'direct')),
  CONSTRAINT advances_status_check CHECK (status IN ('requested', 'active', 'rejected', 'cleared')),
  CONSTRAINT advances_plan_check CHECK (recovery_plan IS NULL OR recovery_plan IN ('full_next', 'installment'))
);

ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enterprise_isolation ON public.advances;
CREATE POLICY enterprise_isolation ON public.advances
  USING (enterprise_id = public.app_current_enterprise_id())
  WITH CHECK (enterprise_id = public.app_current_enterprise_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advances TO app_tenant;

-- A person's outstanding advances + the office's requests/active queues, by status.
CREATE INDEX IF NOT EXISTS advances_user_status ON public.advances (user_id, status);
