-- Fix: enterprise_mcp_config.enterprise_id needs the auto-scope DEFAULT.
--
-- The scoped API writer (generateMcpPassphrase) inserts WITHOUT naming
-- enterprise_id, relying on the column default to fill it from the GUC (the same
-- pattern every Phase-2 table uses: `DEFAULT public.app_current_enterprise_id()`).
-- Migration 0004 created the table WITHOUT that default, so the column came out
-- NULL and the RLS WITH CHECK (enterprise_id = app_current_enterprise_id())
-- rejected every scoped insert. Add the default so scoped upserts self-scope.

ALTER TABLE public.enterprise_mcp_config
  ALTER COLUMN enterprise_id SET DEFAULT public.app_current_enterprise_id();
