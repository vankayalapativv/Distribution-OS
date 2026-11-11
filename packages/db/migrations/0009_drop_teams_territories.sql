-- 0009 — drop Teams & Territories.
--
-- The Users & Teams screen is now users-only: the "Add Team" / "Add Territory"
-- features were removed from the web UI and from the API (the super-admin
-- team/territory routes + service functions). Territory was captured on
-- customers but never set or filtered from any client, and the territory_id
-- columns on orders / invoices / collections / visits / beat_plans were always
-- dormant — no code ever read or wrote them.
--
-- Safe: the API build that stops referencing territory_id ships BEFORE this
-- migration is applied (same deploy-then-migrate rule as 0007). Dropping a
-- column also drops its FK constraint and any index defined on it, so the
-- customers_territory_id_fkey / idx_customers_territory and the five sibling
-- FKs are removed implicitly. team_members is dropped before teams (FK order).

ALTER TABLE public.customers   DROP COLUMN IF EXISTS territory_id;
ALTER TABLE public.orders      DROP COLUMN IF EXISTS territory_id;
ALTER TABLE public.invoices    DROP COLUMN IF EXISTS territory_id;
ALTER TABLE public.collections DROP COLUMN IF EXISTS territory_id;
ALTER TABLE public.visits      DROP COLUMN IF EXISTS territory_id;
ALTER TABLE public.beat_plans  DROP COLUMN IF EXISTS territory_id;

DROP TABLE IF EXISTS public.team_members;
DROP TABLE IF EXISTS public.teams;
DROP TABLE IF EXISTS public.territories;
