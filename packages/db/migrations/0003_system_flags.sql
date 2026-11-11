-- Global cron gate-markers table (multi-enterprise correctness).
--
-- Three maintenance crons self-gate "run at most once per window" by upserting a
-- marker (errors_last_prune_date, notifications_cleanup_last_run,
-- dues_last_run_date). They run from the SCHEDULED handler on the OWNER client,
-- which has no enterprise context — but Phase 2 moved system_settings to a
-- composite PK (enterprise_id, key) with enterprise_id NOT NULL, so those upserts
-- now violate the NOT NULL (the owner client's app_current_enterprise_id() is
-- NULL). These markers are genuinely GLOBAL (error/notification cleanup spans all
-- enterprises; they are not per-enterprise settings), so they belong in their own
-- enterprise-agnostic table rather than in the scoped system_settings.
--
-- system_flags is a plain global key/value store: no enterprise_id, no RLS (like
-- roles/role_permissions). Safe to write from the owner client.

CREATE TABLE IF NOT EXISTS public.system_flags (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
