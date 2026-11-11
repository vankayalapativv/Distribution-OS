import type { SqlClient } from "../lib/db";

/** IST hour of day (0–23). 8 PM (20) is the beat day-end cutoff — the same time
 *  SE GPS tracking auto-stops. */
function istHour(nowMs = Date.now()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowMs));
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

/**
 * After the 8 PM IST day-end, mark today's still-unvisited beat stops as
 * 'missed'. Idempotent — only flips 'pending' → 'missed' and only past the
 * cutoff, so it's safe to run on every maintenance tick (a no-op before 8 PM or
 * once every stop is settled). Persisting it (vs computing in the UI) lets the
 * web / customer Visits tab surface missed stops too. Returns rows changed.
 */
export async function markMissedBeatStops(sql: SqlClient): Promise<number> {
  if (istHour() < 20) return 0;
  const rows = (await sql`
    /* mark_missed_beat_stops */
    update beat_plan_stops bps
    set stop_status = 'missed'
    where bps.stop_status = 'pending'
      and bps.beat_plan_id in (select id from beat_plans where plan_date = (now() at time zone 'Asia/Kolkata')::date)
      -- Never mark a customer 'missed' if they were actually visited that day by
      -- the same SE (guards the create→check-in→materialize race that would
      -- otherwise leave an unlinked 'pending' stop to be flipped to 'missed').
      and not exists (
        select 1
        from visits v
        join beat_plans bp on bp.id = bps.beat_plan_id
        where v.customer_id = bps.customer_id
          and v.executive_id = bp.executive_id
          and v.visit_date = bp.plan_date
      )
    returning bps.id as id
  `) as { id: unknown }[];
  return rows.length;
}
