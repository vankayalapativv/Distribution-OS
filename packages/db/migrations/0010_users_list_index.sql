-- Index backing the server-paged Users list (GET /super-admin/users/paged).
--
-- The list runs enterprise-scoped under RLS, so every query carries an implicit
-- `enterprise_id = app_current_enterprise_id()` predicate, then filters by status
-- and orders by name (the default sort). A composite index leading with
-- enterprise_id keeps that path indexed as the table grows per tenant.
--
-- Plain btree, no RLS concern (indexes carry none). IF NOT EXISTS so re-running is
-- safe.

CREATE INDEX IF NOT EXISTS users_list_idx
    ON public.users (enterprise_id, status, name);
