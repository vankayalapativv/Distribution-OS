-- ============================================================================
-- Live-tracking fix verification  (2026-08-08)
-- ============================================================================
-- Objective yes/no on whether the live-tracking fixes (A native direct upload,
-- B OEM capture hardening, C heartbeat, D JS-uploader wedge) actually solved the
-- field problem — run this AFTER Sandeep & Murali have run the new APK for a day.
--
--   psql "$DATABASE_URL" -f packages/db/scripts/tracking-verification.sql
--
-- Reads only (no writes). Covers the last 10 days for the two trial SEs.
--
-- The two problems were distinct, so the two SEs are the two tests:
--   • Murali (realme) — CAPTURE was already perfect; the bug was UPLOAD lag.
--       Watch `upl_p50_s` / `upl_max_s`.  PASS = upload lag collapses.
--   • Sandeep (vivo)  — UPLOAD was prompt; the bug was CAPTURE being killed.
--       Watch `gaps_gt12m` / `maxgap_m` / `pts`.  PASS = gaps shrink, pts rise.
--
-- ---------------------------------------------------------------------------
-- PRE-FIX BASELINE (captured 2026-08-08, for diffing) — recorded_at IST date:
--   Murali  08-06 : pts=118  gaps_gt12m=0  maxgap=7    upl_p50=60859s(~17h) upl_max=73726s(~20h)
--   Murali  08-05 : pts=143  gaps_gt12m=0  maxgap=7    upl_p50=724s         upl_max=19192s
--   Murali  08-07 : pts=79   gaps_gt12m=0  maxgap=7    upl_p50=1282s        upl_max=8734s
--   Sandeep 08-07 : pts=71   gaps_gt12m=11 maxgap=51   upl_p50=275s         upl_max=2469s
--   Sandeep 08-06 : pts=24   gaps_gt12m=2  maxgap=146  upl_p50=110s         upl_max=873s
--   Sandeep 08-08 : pts=2    gaps_gt12m=1  maxgap=99   (service died after start)
--
-- SUCCESS CRITERIA (post-APK):
--   Murali  : upl_p50_s  < ~30s   AND upl_max_s < a few minutes   (was up to ~17h)
--   Sandeep : gaps_gt12m ≈ 0, maxgap_m < ~12, pts per full day ≈ 150+  (needs the
--             autostart whitelist actually enabled — B is conditional on that)
-- ---------------------------------------------------------------------------

-- Per-day scorecard: coverage, capture gaps, and upload lag (recorded→created).
with pts as (
  select u.name,
         (p.recorded_at at time zone 'Asia/Kolkata')::date d,
         p.recorded_at,
         extract(epoch from (p.recorded_at
           - lag(p.recorded_at) over (
               partition by u.id, (p.recorded_at at time zone 'Asia/Kolkata')::date
               order by p.recorded_at)))/60 gap_min,
         extract(epoch from (p.created_at - p.recorded_at)) lag_s
  from gps_points p
  join users u on u.id = p.user_id
  where u.name in ('Sandeep', 'Murali')
    and p.recorded_at > now() - interval '10 days'
)
select name,
       d,
       count(*) pts,
       round(extract(epoch from (max(recorded_at) - min(recorded_at)))/60) span_min,
       count(*) filter (where gap_min > 12) gaps_gt12m,   -- Sandeep signal (capture)
       round(max(gap_min)) maxgap_m,                       -- Sandeep signal (capture)
       round(percentile_cont(0.5) within group (order by lag_s)) upl_p50_s, -- Murali signal (upload)
       round(max(lag_s)) upl_max_s                         -- Murali signal (upload)
from pts
group by name, d
order by d desc, name;

-- Backlog check (Murali): queued_point_count should no longer climb into the
-- tens during the day — the native uploader/JS-wedge fix should keep it near 0.
select u.name,
       (h.captured_at at time zone 'Asia/Kolkata')::date d,
       max(h.queued_point_count) max_queued,
       max(h.battery_optimization_status) bat_opt,
       max(h.manufacturer || ' ' || h.model) device
from tracking_device_heartbeats h
join users u on u.id = h.user_id
where u.name in ('Sandeep', 'Murali')
  and h.captured_at > now() - interval '10 days'
group by 1, 2
order by 2 desc, 1;
