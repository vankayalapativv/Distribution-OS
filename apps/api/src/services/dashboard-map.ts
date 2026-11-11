import type { SqlClient } from "../lib/db";
import { loadDuesBands, bandKeyFromAge, type DuesBand } from "./dues";

/**
 * Data for the Dashboard OpenStreetMap section (SUPER_ADMIN + MANAGER).
 *
 * The customer layer plots every active customer that has coordinates, coloured
 * by its collection-dues AGEING bucket — the SAME rule and source as the
 * Collection Dues card (oldest invoice/opening-balance with outstanding_amount,
 * aged in IST), so the map reads as a geographic view of that card. The activity
 * layer is today's live field picture (SE positions, check-ins, day routes) and
 * is fetched separately, only when a toggle turns it on.
 */

type Row = Record<string, unknown>;

const numOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  return typeof v === "number" ? v : Number(v);
};
const num = (v: unknown): number => numOrNull(v) ?? 0;
const str = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
};
const strOrNull = (v: unknown): string | null => {
  const s = str(v);
  return s.length > 0 ? s : null;
};

/** A customer's dues bucket is the enterprise band's key (its ordinal as a
 *  string, "0".."3"), or null when they have no outstanding. */
export type DuesBucketKey = string;

export interface MapCustomer {
  id: string;
  name: string;
  code: string;
  city: string | null;
  lat: number;
  lng: number;
  executiveId: string | null;
  executiveName: string | null;
  outstanding: number;
  ageDays: number | null;
  bucket: DuesBucketKey | null;
  /** Days since this customer's most recent non-cancelled order (IST), or null if
   *  they have never ordered. Across ALL salespeople. */
  lastOrderDays: number | null;
  /** Days since this customer's most recent non-rejected collection (IST), or null
   *  if they have never been collected from. Across ALL salespeople. */
  lastCollectionDays: number | null;
  /** Placed ≥1 order OR made ≥1 collection in the last 30 days (IST). */
  active: boolean;
}

export interface DashboardMapData {
  customers: MapCustomer[];
  /** The enterprise's dues bands (ordinal order) — labels/ranges for the map
   *  legend, dot popups and the district ageing table. */
  bands: DuesBand[];
}

export async function getDashboardMapCustomers(sql: SqlClient): Promise<DashboardMapData> {
  const bands = await loadDuesBands(sql);
  const rows = (await sql`
    /* dashboard_map_customers */
    with dues as (
      select
        customer_id,
        ((now() at time zone 'Asia/Kolkata')::date - min(invoice_date)) as age_days,
        sum(outstanding_amount) as outstanding
      from (
        select customer_id, invoice_date, outstanding_amount
          from invoices where outstanding_amount > 0
        union all
        select customer_id, as_of_date as invoice_date, outstanding_amount
          from customer_opening_balances where outstanding_amount > 0
      ) x
      group by customer_id
    )
    select
      c.id,
      c.legal_name as "name",
      c.customer_code as "code",
      c.address_city as "city",
      c.latitude as "lat",
      c.longitude as "lng",
      c.created_by as "executiveId",
      u.name as "executiveName",
      coalesce(d.outstanding, 0)::numeric as "outstanding",
      d.age_days as "ageDays",
      (select ((now() at time zone 'Asia/Kolkata')::date - max(o.order_date))
         from orders o
        where o.customer_id = c.id and o.order_status <> 'cancelled') as "lastOrderDays",
      (select ((now() at time zone 'Asia/Kolkata')::date - max(col.collection_date))
         from collections col
        where col.customer_id = c.id
          and col.accountant_approval_status is distinct from 'rejected') as "lastCollectionDays",
      (
        exists (
          select 1 from orders o
          where o.customer_id = c.id
            and o.order_date >= (now() at time zone 'Asia/Kolkata')::date - 30
        )
        or exists (
          select 1 from collections col
          where col.customer_id = c.id
            and col.collection_date >= (now() at time zone 'Asia/Kolkata')::date - 30
        )
      ) as "active"
    from customers c
    left join users u on u.id = c.created_by
    left join dues d on d.customer_id = c.id
    where c.status = 'active'
      and c.latitude is not null
      and c.longitude is not null
    order by d.age_days desc nulls last
  `) as Row[];

  const customers = rows.map((r) => {
    const ageDays = numOrNull(r.ageDays);
    return {
      id: str(r.id),
      name: str(r.name),
      code: str(r.code),
      city: strOrNull(r.city),
      lat: num(r.lat),
      lng: num(r.lng),
      executiveId: strOrNull(r.executiveId),
      executiveName: strOrNull(r.executiveName),
      outstanding: num(r.outstanding),
      ageDays,
      bucket: bandKeyFromAge(ageDays, bands),
      lastOrderDays: numOrNull(r.lastOrderDays),
      lastCollectionDays: numOrNull(r.lastCollectionDays),
      active: Boolean(r.active),
    };
  });
  return { customers, bands };
}

// ── Today's live field activity (fetched only when a toggle is on) ───────────

export interface MapPosition {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  recordedAt: string | null;
  live: boolean;
}
export interface MapCheckin {
  visitId: string;
  customerId: string;
  customerName: string;
  lat: number;
  lng: number;
  executiveName: string | null;
  at: string | null;
  type: string;
}
export interface MapRoute {
  userId: string;
  name: string;
  points: { lat: number; lng: number }[];
}
export interface MapActivity {
  positions: MapPosition[];
  checkins: MapCheckin[];
  routes: MapRoute[];
}

export async function getDashboardMapActivity(sql: SqlClient): Promise<MapActivity> {
  // Latest position per sales executive whose ping lands today (IST). "live" =
  // seen in the last 12 minutes (the Live-Tracking freshness rule).
  const positions = (await sql`
    /* dashboard_map_positions */
    select
      ell.user_id as "userId",
      u.name as "name",
      ell.latitude as "lat",
      ell.longitude as "lng",
      ell.recorded_at as "recordedAt",
      (ell.recorded_at > now() - interval '12 minutes') as "live"
    from executive_latest_locations ell
    join users u on u.id = ell.user_id
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id and r.code = 'SALES_EXECUTIVE'
    where ell.latitude is not null and ell.longitude is not null
      and (ell.recorded_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
  `) as Row[];

  // Today's check-ins that carry a GPS fix.
  const checkins = (await sql`
    /* dashboard_map_checkins */
    select
      v.id as "visitId",
      v.customer_id as "customerId",
      c.legal_name as "customerName",
      v.check_in_latitude as "lat",
      v.check_in_longitude as "lng",
      u.name as "executiveName",
      v.check_in_time as "at",
      v.planned_or_unplanned as "type"
    from visits v
    join customers c on c.id = v.customer_id
    left join users u on u.id = v.executive_id
    where v.visit_date = (now() at time zone 'Asia/Kolkata')::date
      and v.check_in_latitude is not null and v.check_in_longitude is not null
    order by v.check_in_time
  `) as Row[];

  // Each SE's ordered GPS trail for today's session(s).
  const routeRows = (await sql`
    /* dashboard_map_routes */
    select
      s.user_id as "userId",
      u.name as "name",
      coalesce(
        json_agg(json_build_object('lat', p.latitude, 'lng', p.longitude)
                 order by p.recorded_at),
        '[]'
      ) as "points"
    from gps_tracking_sessions s
    join users u on u.id = s.user_id
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id and r.code = 'SALES_EXECUTIVE'
    join gps_points p on p.session_id = s.id
    where s.session_date = (now() at time zone 'Asia/Kolkata')::date
    group by s.user_id, u.name
  `) as Row[];

  return {
    positions: positions.map((r) => ({
      userId: str(r.userId),
      name: str(r.name),
      lat: num(r.lat),
      lng: num(r.lng),
      recordedAt: strOrNull(r.recordedAt),
      live: Boolean(r.live),
    })),
    checkins: checkins.map((r) => ({
      visitId: str(r.visitId),
      customerId: str(r.customerId),
      customerName: str(r.customerName),
      lat: num(r.lat),
      lng: num(r.lng),
      executiveName: strOrNull(r.executiveName),
      at: strOrNull(r.at),
      type: r.type === "planned" ? "planned" : "unplanned",
    })),
    routes: routeRows.map((r) => ({
      userId: str(r.userId),
      name: str(r.name),
      points: Array.isArray(r.points)
        ? (r.points as { lat: unknown; lng: unknown }[]).map((p) => ({
            lat: num(p.lat),
            lng: num(p.lng),
          }))
        : [],
    })),
  };
}
