-- 0008 — Enforce exactly 4 collection-dues bands per enterprise.
--
-- The dues model is now FIXED at 4 bands (ranges + labels stay per-enterprise):
-- it drives the dashboard's 4-sided cross, and both onboarding and the new
-- Settings → Collection Dues editor save exactly 4. This backfills existing data:
-- any enterprise whose dues_bands count is not 4 is reset to the 4 default bands
-- (0-30 / 31-45 / 46-60 / 61+), which stay fully editable in Settings. An
-- enterprise that already has a valid 4-band set (default OR custom) is untouched.

BEGIN;

-- Drop the bands of every off-count enterprise (so they re-seed to the 4 defaults).
delete from dues_bands
where enterprise_id in (
  select enterprise_id from dues_bands group by enterprise_id having count(*) <> 4
);

-- Seed the 4 defaults for every enterprise that now has NO bands (the reset ones
-- plus any never-configured enterprise).
insert into dues_bands (enterprise_id, ordinal, from_days, to_days, label)
select e.id, v.ordinal, v.from_days, v.to_days, v.label
from public.enterprises e
cross join (values
  (0, 0, 30, '0–30 days'),
  (1, 31, 45, '31–45 days'),
  (2, 46, 60, '46–60 days'),
  (3, 61, null::int, '61+ days')
) as v(ordinal, from_days, to_days, label)
where not exists (select 1 from dues_bands d where d.enterprise_id = e.id);

COMMIT;
