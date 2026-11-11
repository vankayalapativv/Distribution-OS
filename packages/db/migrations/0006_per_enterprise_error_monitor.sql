-- 0006 — Per-enterprise error observability (Phase 6 hardening).
--
-- The in-house error monitor (error_events / error_groups) had NO enterprise_id
-- and NO row-level security, yet the /errors viewer is exposed to every
-- enterprise's SUPER_ADMIN via the scoped client — so one tenant's admin could
-- read another tenant's error messages + stack traces. This tags both tables
-- per enterprise and isolates them with RLS (mirroring 0001):
--   * errors from an authenticated enterprise request  → enterprise_id = that enterprise
--   * errors with no enterprise (login/public/webhook/cron) → enterprise_id NULL,
--     visible only to the owner client (which bypasses RLS), never to a tenant.
-- Group dedup moves from global `fingerprint` to `(enterprise_id, fingerprint)`
-- so the same bug in two enterprises is two groups (own counts + own sample
-- stack), while NULLS NOT DISTINCT keeps platform/unauth errors collapsing by
-- fingerprint.

BEGIN;

ALTER TABLE public.error_events ADD COLUMN IF NOT EXISTS enterprise_id uuid REFERENCES public.enterprises(id);
ALTER TABLE public.error_groups ADD COLUMN IF NOT EXISTS enterprise_id uuid REFERENCES public.enterprises(id);

CREATE INDEX IF NOT EXISTS error_events_enterprise_id_idx ON public.error_events (enterprise_id);
CREATE INDEX IF NOT EXISTS error_groups_enterprise_id_idx ON public.error_groups (enterprise_id);

-- Re-key group dedup per enterprise (NULLS NOT DISTINCT so platform/unauth errors
-- still collapse by fingerprint). Replaces the global fingerprint unique.
ALTER TABLE public.error_groups DROP CONSTRAINT IF EXISTS error_groups_fingerprint_key;
ALTER TABLE public.error_groups DROP CONSTRAINT IF EXISTS error_groups_enterprise_fingerprint_key;
ALTER TABLE public.error_groups
  ADD CONSTRAINT error_groups_enterprise_fingerprint_key UNIQUE NULLS NOT DISTINCT (enterprise_id, fingerprint);

-- RLS: ENABLE (not FORCE) so the owner (server-side capture + cross-enterprise
-- reads) bypasses it while app_tenant obeys. app_tenant/app_readonly already hold
-- the table grants from 0001's GRANT ... ON ALL TABLES.
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enterprise_isolation ON public.error_events;
CREATE POLICY enterprise_isolation ON public.error_events
  USING (enterprise_id = public.app_current_enterprise_id())
  WITH CHECK (enterprise_id = public.app_current_enterprise_id());

ALTER TABLE public.error_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enterprise_isolation ON public.error_groups;
CREATE POLICY enterprise_isolation ON public.error_groups
  USING (enterprise_id = public.app_current_enterprise_id())
  WITH CHECK (enterprise_id = public.app_current_enterprise_id());

COMMIT;
