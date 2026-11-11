-- 0007 — Scope two global unique indexes per enterprise (multi-tenancy correctness).
--
-- Both predate the enterprise_id work and stayed GLOBAL, so a second enterprise
-- collided with the first. The app's own checks already run enterprise-scoped
-- (RLS), so these indexes were both wrong AND inconsistent with the app:
--   * stock_locations_one_default_idx — enforced ONE default location across ALL
--     enterprises. Hit during onboarding submit: the 2nd enterprise's default
--     godown violated the 1st enterprise's. → one default PER enterprise.
--   * customers_active_phone_unique — a retailer phone was unique across ALL
--     enterprises, so two distributors could not both serve the same retailer. →
--     unique per enterprise.

BEGIN;

DROP INDEX IF EXISTS public.stock_locations_one_default_idx;
CREATE UNIQUE INDEX stock_locations_one_default_idx
  ON public.stock_locations (enterprise_id)
  WHERE is_default;

DROP INDEX IF EXISTS public.customers_active_phone_unique;
CREATE UNIQUE INDEX customers_active_phone_unique
  ON public.customers (enterprise_id, right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10))
  WHERE (status = 'active' AND length(right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)) = 10);

COMMIT;
