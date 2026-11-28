-- Remove Salary & Advances (and the Employee ledger that read them) entirely,
-- 2026-11-28. The field-expense feature is being pared back to CLAIMS +
-- REIMBURSEMENT only; salary/advances will be revisited later as a per-employee
-- ledger. Drop the four tables (and their data) now.
--
-- Kept: expenditures (claims book here), reimbursement_payables (a claim's
-- reimbursement record, created paid at approval), expenditure_categories.
--
-- Order matters: salary_payment_recoveries references both salary_payments and
-- advances; drop it first. CASCADE is belt-and-suspenders for RLS policies/grants.

DROP TABLE IF EXISTS public.salary_payment_recoveries CASCADE;
DROP TABLE IF EXISTS public.salary_payments CASCADE;
DROP TABLE IF EXISTS public.staff_salaries CASCADE;
DROP TABLE IF EXISTS public.advances CASCADE;
