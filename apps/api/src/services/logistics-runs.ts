import type { SqlClient } from "../lib/db";
import { resolvePage, resolveSort } from "../lib/pagination";
import {
  dateOf, dateStr, likeOf, num, numOrNull, str, strOrNull,
  type ListParams, type Paged, type Row,
} from "./logistics-shared";

export interface DeliveryRunRow {
  runId: string;
  date: string;
  driverName: string | null;
  vehicleNumber: string | null;
  startedAt: string;
  endedAt: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
  distanceKm: number | null;
  status: string;
  stopCount: number;
  photoCount: number;
}

/** WHERE for the runs list: search matches driver name OR vehicle; date on run_date. */
function runsWhere(filters: ListParams): { whereSql: string; params: unknown[] } {
  const like = likeOf(filters.q);
  const from = dateOf(filters.from);
  const to = dateOf(filters.to);
  const params: unknown[] = [];
  const conds: string[] = [];
  if (like) {
    params.push(like);
    const p = `$${params.length}`;
    conds.push(`(u.name ilike ${p} or r.vehicle_number ilike ${p})`);
  }
  if (from) { params.push(from); conds.push(`r.run_date >= $${params.length}::date`); }
  if (to) { params.push(to); conds.push(`r.run_date <= $${params.length}::date`); }
  return { whereSql: conds.length ? `where ${conds.join(" and ")}` : "", params };
}

const RUN_SORTS: Record<string, string> = {
  date: "r.started_at",
  driverName: "u.name",
  stopCount: '"stopCount"',
  status: "r.status",
};

function mapRun(r: Row): DeliveryRunRow {
  const start = numOrNull(r.startOdometer);
  const end = numOrNull(r.endOdometer);
  return {
    runId: str(r.runId),
    date: dateStr(r.date),
    driverName: strOrNull(r.driverName),
    vehicleNumber: strOrNull(r.vehicleNumber),
    startedAt: str(r.startedAt),
    endedAt: strOrNull(r.endedAt),
    startOdometer: start,
    endOdometer: end,
    distanceKm: start != null && end != null ? Math.round((end - start) * 10) / 10 : null,
    status: str(r.status),
    stopCount: num(r.stopCount),
    photoCount: num(r.photoCount),
  };
}

/** Paginated: one row per delivery run (driver's day), newest first. */
export async function listDeliveryRuns(sql: SqlClient, params: ListParams): Promise<Paged<DeliveryRunRow>> {
  const { whereSql, params: p } = runsWhere(params);
  const sort = resolveSort(params.sort, params.dir, RUN_SORTS, "date");
  const { limit, offset, page, pageSize } = resolvePage(params.page, params.pageSize);

  // Count and page are independent — one parallel batch, not two sequential
  // ~50ms round-trips.
  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* logistics_runs_count */
     select count(*)::int as total
     from delivery_runs r left join users u on u.id = r.logistics_user_id ${whereSql}`,
      p,
    ),
    sql.query(
      `/* logistics_runs */
     select r.id as "runId", r.run_date as "date", u.name as "driverName",
       r.vehicle_number as "vehicleNumber", r.started_at as "startedAt", r.ended_at as "endedAt",
       r.start_odometer as "startOdometer", r.end_odometer as "endOdometer", r.status,
       (select count(*) from delivery_run_stops s where s.run_id = r.id)::int as "stopCount",
       (select count(*) from delivery_photos p where p.run_id = r.id and p.kind = 'delivery')::int as "photoCount"
     from delivery_runs r left join users u on u.id = r.logistics_user_id
     ${whereSql}
     order by ${sort.expr} ${sort.dir} nulls last, r.started_at desc
     limit $${p.length + 1} offset $${p.length + 2}`,
      [...p, limit, offset],
    ),
  ]);
  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return { rows: rows.map(mapRun), total: num(countRow?.total), page, pageSize };
}
