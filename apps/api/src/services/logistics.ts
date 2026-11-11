import type { R2Bucket } from "@cloudflare/workers-types";
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { resolvePage, resolveSort } from "../lib/pagination";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return v == null ? "" : String(v);
}
function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}
function dateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return "";
}
function num(v: unknown): number {
  return Number(v ?? 0);
}
function numOrNull(v: unknown): number | null {
  return v == null ? null : Number(v);
}

export interface ListParams {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

function likeOf(q?: string | null): string | null {
  const t = (q ?? "").trim();
  return t.length > 0 ? `%${t}%` : null;
}
function dateOf(d?: string | null): string | null {
  const t = (d ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

// Re-exported so existing imports from "./logistics" keep working; the helpers
// now live in ../lib/pagination and are shared with the other tables.
export { resolvePage, resolveSort };

/** Build the shared WHERE clause + positional params from the filters. */
function buildWhere(filters: ListParams): { whereSql: string; params: unknown[] } {
  const like = likeOf(filters.q);
  const from = dateOf(filters.from);
  const to = dateOf(filters.to);
  const params: unknown[] = [];
  const conds: string[] = [];
  if (like) {
    params.push(like);
    const p = `$${params.length}`;
    conds.push(`(c.legal_name ilike ${p} or c.customer_code ilike ${p})`);
  }
  if (from) {
    params.push(from);
    conds.push(`r.run_date >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conds.push(`r.run_date <= $${params.length}::date`);
  }
  return { whereSql: conds.length ? `where ${conds.join(" and ")}` : "", params };
}

const CUSTOMER_SORTS: Record<string, string> = {
  customerName: '"customerName"',
  area: '"area"',
  deliveryCount: '"deliveryCount"',
  lastDeliveryDate: '"lastDeliveryDate"',
  photoCount: '"photoCount"',
};

/** Aggregated, sorted, paginated: one row per customer who received a delivery. */
export async function listDeliveryCustomers(sql: SqlClient, params: ListParams): Promise<Paged<{
  customerId: string; customerName: string | null; customerCode: string | null;
  area: string | null; deliveryCount: number; lastDeliveryDate: string; photoCount: number;
}>> {
  const { whereSql, params: p } = buildWhere(params);
  const sort = resolveSort(params.sort, params.dir, CUSTOMER_SORTS, "lastDeliveryDate");
  const { limit, offset, page, pageSize } = resolvePage(params.page, params.pageSize);

  // Count and page are independent — one parallel batch, not two sequential
  // ~50ms round-trips.
  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* logistics_customers_count */
     select count(distinct s.customer_id)::int as total
     from delivery_run_stops s
     join delivery_runs r on r.id = s.run_id
     join customers c on c.id = s.customer_id
     ${whereSql}`,
      p,
    ),
    sql.query(
      `/* logistics_customers */
     select
       c.id as "customerId",
       c.legal_name as "customerName",
       c.customer_code as "customerCode",
       coalesce(nullif(c.address_city, ''), nullif(c.address_landmark, '')) as "area",
       count(distinct s.id)::int as "deliveryCount",
       max(r.run_date) as "lastDeliveryDate",
       count(p.id)::int as "photoCount"
     from delivery_run_stops s
     join delivery_runs r on r.id = s.run_id
     join customers c on c.id = s.customer_id
     left join delivery_photos p on p.stop_id = s.id and p.kind = 'delivery'
     ${whereSql}
     group by c.id, c.legal_name, c.customer_code, c.address_city, c.address_landmark
     order by ${sort.expr} ${sort.dir} nulls last, c.legal_name asc
     limit $${p.length + 1} offset $${p.length + 2}`,
      [...p, limit, offset],
    ),
  ]);
  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return {
    rows: rows.map((r) => ({
      customerId: str(r.customerId),
      customerName: strOrNull(r.customerName),
      customerCode: strOrNull(r.customerCode),
      area: strOrNull(r.area),
      deliveryCount: num(r.deliveryCount),
      lastDeliveryDate: dateStr(r.lastDeliveryDate),
      photoCount: num(r.photoCount),
    })),
    total: num(countRow?.total),
    page,
    pageSize,
  };
}

const STOP_SORTS: Record<string, string> = {
  date: "s.created_at",
  customerName: "c.legal_name",
  driverName: "u.name",
  photoCount: '"photoCount"',
};

/** Flat, sorted, paginated: one row per delivery stop. */
export async function listDeliveryStops(sql: SqlClient, params: ListParams): Promise<Paged<ReturnType<typeof mapStop>>> {
  const { whereSql, params: p } = buildWhere(params);
  const sort = resolveSort(params.sort, params.dir, STOP_SORTS, "date");
  const { limit, offset, page, pageSize } = resolvePage(params.page, params.pageSize);

  // Count and page are independent — one parallel batch, not two sequential
  // ~50ms round-trips.
  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* logistics_stops_count */
     select count(*)::int as total
     from delivery_run_stops s
     join delivery_runs r on r.id = s.run_id
     join customers c on c.id = s.customer_id
     ${whereSql}`,
      p,
    ),
    sql.query(
      `/* logistics_stops */
     select
       s.id as "stopId",
       s.run_id as "runId",
       r.run_date as "date",
       s.created_at as "createdAt",
       c.id as "customerId",
       c.legal_name as "customerName",
       c.customer_code as "customerCode",
       u.name as "driverName",
       r.vehicle_number as "vehicleNumber",
       s.latitude,
       s.longitude,
       (select count(*) from delivery_photos p where p.stop_id = s.id and p.kind = 'delivery')::int as "photoCount"
     from delivery_run_stops s
     join delivery_runs r on r.id = s.run_id
     join customers c on c.id = s.customer_id
     left join users u on u.id = r.logistics_user_id
     ${whereSql}
     order by ${sort.expr} ${sort.dir} nulls last, s.created_at desc
     limit $${p.length + 1} offset $${p.length + 2}`,
      [...p, limit, offset],
    ),
  ]);
  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return { rows: rows.map(mapStop), total: num(countRow?.total), page, pageSize };
}

function mapStop(r: Row) {
  return {
    stopId: str(r.stopId),
    runId: str(r.runId),
    date: dateStr(r.date),
    createdAt: str(r.createdAt),
    customerId: str(r.customerId),
    customerName: strOrNull(r.customerName),
    customerCode: strOrNull(r.customerCode),
    driverName: strOrNull(r.driverName),
    vehicleNumber: strOrNull(r.vehicleNumber),
    latitude: numOrNull(r.latitude),
    longitude: numOrNull(r.longitude),
    photoCount: num(r.photoCount),
  };
}

/** Full detail for one customer: contact + each delivery event with its photos. */
export async function getCustomerDeliveryDetail(
  sql: SqlClient,
  customerId: string,
  filters: ListParams,
) {
  const [customer] = (await sql`
    /* logistics_customer */
    select
      id,
      legal_name as "customerName",
      customer_code as "customerCode",
      phone,
      nullif(concat_ws(', ', nullif(address_street, ''), nullif(address_city, ''), nullif(address_state, '')), '') as "address",
      address_landmark as "landmark"
    from customers
    where id = ${customerId}::uuid
  `) as Row[];
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found.", 404);

  const from = dateOf(filters.from);
  const to = dateOf(filters.to);
  const stops = (await sql`
    /* logistics_customer_stops */
    select
      s.id as "stopId",
      s.run_id as "runId",
      r.run_date as "date",
      s.created_at as "createdAt",
      u.name as "driverName",
      r.vehicle_number as "vehicleNumber",
      s.latitude,
      s.longitude
    from delivery_run_stops s
    join delivery_runs r on r.id = s.run_id
    left join users u on u.id = r.logistics_user_id
    where s.customer_id = ${customerId}::uuid
      and (${from}::date is null or r.run_date >= ${from}::date)
      and (${to}::date is null or r.run_date <= ${to}::date)
    order by s.created_at desc
  `) as Row[];

  const photos = (await sql`
    /* logistics_customer_photos */
    select p.id, p.stop_id as "stopId", p.kind, p.content_type as "contentType", p.created_at as "createdAt"
    from delivery_photos p
    join delivery_run_stops s on s.id = p.stop_id
    where s.customer_id = ${customerId}::uuid and p.kind = 'delivery'
    order by p.created_at asc
  `) as Row[];

  const photosByStop = new Map<string, Array<{ id: string; contentType: string | null; createdAt: string }>>();
  for (const p of photos) {
    const key = str(p.stopId);
    const list = photosByStop.get(key) ?? [];
    list.push({ id: str(p.id), contentType: strOrNull(p.contentType), createdAt: str(p.createdAt) });
    photosByStop.set(key, list);
  }

  return {
    customer: {
      customerId: str(customer.id),
      customerName: strOrNull(customer.customerName),
      customerCode: strOrNull(customer.customerCode),
      phone: strOrNull(customer.phone),
      address: strOrNull(customer.address),
      landmark: strOrNull(customer.landmark),
    },
    events: stops.map((s) => ({
      stopId: str(s.stopId),
      runId: str(s.runId),
      date: dateStr(s.date),
      createdAt: str(s.createdAt),
      driverName: strOrNull(s.driverName),
      vehicleNumber: strOrNull(s.vehicleNumber),
      latitude: numOrNull(s.latitude),
      longitude: numOrNull(s.longitude),
      photos: photosByStop.get(str(s.stopId)) ?? [],
    })),
  };
}

/** Stream a delivery photo's bytes from R2 (auth enforced at the route). */
export async function getDeliveryPhotoStream(
  sql: SqlClient,
  bucket: R2Bucket,
  photoId: string,
): Promise<{ body: ReadableStream; contentType: string }> {
  const [photo] = (await sql`
    /* logistics_photo_by_id */
    select id, file_key as "fileKey", content_type as "contentType"
    from delivery_photos
    where id = ${photoId}::uuid
  `) as Row[];
  if (!photo) throw new ApiError("NOT_FOUND", "Photo not found.", 404);

  const object = await bucket.get(str(photo.fileKey));
  if (!object) throw new ApiError("NOT_FOUND", "Photo file is missing from storage.", 404);

  return {
    body: object.body as unknown as ReadableStream,
    contentType: str(photo.contentType) || "image/jpeg",
  };
}
