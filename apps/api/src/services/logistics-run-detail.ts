import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { dateStr, num, numOrNull, str, strOrNull, type Row } from "./logistics-shared";

interface OdometerPhoto {
  id: string;
  contentType: string | null;
}
interface RunStop {
  stopId: string;
  customerId: string;
  customerName: string | null;
  customerCode: string | null;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  photos: Array<{ id: string; contentType: string | null; createdAt: string }>;
}

/** One run's full detail: start/end bookends (times, odometers, odometer photos)
 *  plus the ordered delivery stops with their proof photos. */
export async function getRunDetail(sql: SqlClient, runId: string) {
  const [run] = (await sql`
    /* logistics_run */
    select r.id as "runId", r.run_date as "date", u.name as "driverName",
      r.vehicle_number as "vehicleNumber", r.started_at as "startedAt", r.ended_at as "endedAt",
      r.start_odometer as "startOdometer", r.end_odometer as "endOdometer", r.status
    from delivery_runs r left join users u on u.id = r.logistics_user_id
    where r.id = ${runId}::uuid
  `) as Row[];
  if (!run) throw new ApiError("NOT_FOUND", "Delivery run not found.", 404);

  const odoPhotos = (await sql`
    /* logistics_run_odometer_photos */
    select id, kind, content_type as "contentType"
    from delivery_photos
    where run_id = ${runId}::uuid and kind in ('start_odometer', 'end_odometer')
  `) as Row[];
  const odo = (kind: string): OdometerPhoto | null => {
    const p = odoPhotos.find((x) => str(x.kind) === kind);
    return p ? { id: str(p.id), contentType: strOrNull(p.contentType) } : null;
  };

  const stops = (await sql`
    /* logistics_run_stops */
    select s.id as "stopId", c.id as "customerId", c.legal_name as "customerName",
      c.customer_code as "customerCode", s.created_at as "createdAt", s.latitude, s.longitude
    from delivery_run_stops s join customers c on c.id = s.customer_id
    where s.run_id = ${runId}::uuid
    order by s.created_at asc
  `) as Row[];

  const photos = (await sql`
    /* logistics_run_stop_photos */
    select p.id, p.stop_id as "stopId", p.content_type as "contentType", p.created_at as "createdAt"
    from delivery_photos p
    where p.run_id = ${runId}::uuid and p.kind = 'delivery'
    order by p.created_at asc
  `) as Row[];
  const byStop = new Map<string, RunStop["photos"]>();
  for (const p of photos) {
    const key = str(p.stopId);
    const list = byStop.get(key) ?? [];
    list.push({ id: str(p.id), contentType: strOrNull(p.contentType), createdAt: str(p.createdAt) });
    byStop.set(key, list);
  }

  const start = numOrNull(run.startOdometer);
  const end = numOrNull(run.endOdometer);
  return {
    run: {
      runId: str(run.runId),
      date: dateStr(run.date),
      driverName: strOrNull(run.driverName),
      vehicleNumber: strOrNull(run.vehicleNumber),
      startedAt: str(run.startedAt),
      endedAt: strOrNull(run.endedAt),
      startOdometer: start,
      endOdometer: end,
      distanceKm: start != null && end != null ? Math.round((end - start) * 10) / 10 : null,
      status: str(run.status),
      startPhoto: odo("start_odometer"),
      endPhoto: odo("end_odometer"),
    },
    stops: stops.map((s): RunStop => ({
      stopId: str(s.stopId),
      customerId: str(s.customerId),
      customerName: strOrNull(s.customerName),
      customerCode: strOrNull(s.customerCode),
      createdAt: str(s.createdAt),
      latitude: numOrNull(s.latitude),
      longitude: numOrNull(s.longitude),
      photos: byStop.get(str(s.stopId)) ?? [],
    })),
  };
}
