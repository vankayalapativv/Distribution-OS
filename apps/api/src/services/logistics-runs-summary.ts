import type { SqlClient } from "../lib/db";
import { num, type Row } from "./logistics-shared";

export interface RunsSummary {
  runsToday: number;
  activeNow: number;
  stopsToday: number;
  distanceKm: number;
}

/** Today's (IST) delivery-run glance: run count, active runs, stops, distance.
 *  Independent of the table's date filter — it's the "today at a glance" strip. */
export async function getRunsSummary(sql: SqlClient): Promise<RunsSummary> {
  const [r] = (await sql`
    /* logistics_runs_summary */
    with today as (select (now() at time zone 'Asia/Kolkata')::date as d)
    select
      (select count(*) from delivery_runs r, today
        where r.run_date = today.d)::int as "runsToday",
      (select count(*) from delivery_runs r, today
        where r.run_date = today.d and r.status = 'active')::int as "activeNow",
      (select count(*) from delivery_run_stops s
        join delivery_runs r on r.id = s.run_id, today
        where r.run_date = today.d)::int as "stopsToday",
      (select coalesce(sum(r.end_odometer - r.start_odometer), 0) from delivery_runs r, today
        where r.run_date = today.d and r.end_odometer is not null and r.start_odometer is not null)::numeric as "distanceKm"
  `) as Row[];

  return {
    runsToday: num(r?.runsToday),
    activeNow: num(r?.activeNow),
    stopsToday: num(r?.stopsToday),
    distanceKm: Math.round(num(r?.distanceKm) * 10) / 10,
  };
}
