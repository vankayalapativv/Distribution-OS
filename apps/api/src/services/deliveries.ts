import type { R2Bucket } from "@cloudflare/workers-types";
import { R2_STORAGE_CLASS } from "../lib/r2";
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { recomputeFulfillmentForInvoice } from "./fulfillment";
import type { PhotoGeo } from "../lib/geocode";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}
function strOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (v instanceof Date) return v.toISOString();
  return null;
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface Ctx {
  userId: string;
}

/** Push target for the SE "order delivered" notification (fired by the route). */
export interface DeliveryPush {
  tokens: string[];
  title: string;
  body: string;
}

export const VALID_PHOTO_KINDS = new Set(["start_odometer", "end_odometer", "delivery"]);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function mapRun(row: Row) {
  return {
    id: str(row.id),
    logisticsUserId: str(row.logisticsUserId),
    runDate: str(row.runDate),
    vehicleNumber: str(row.vehicleNumber),
    startOdometer: numOrNull(row.startOdometer),
    endOdometer: numOrNull(row.endOdometer),
    status: str(row.status),
    startedAt: str(row.startedAt),
    endedAt: strOrNull(row.endedAt),
  };
}

/** Start a run: idempotent replay by clientUuid; if an active run already
 *  exists today it is returned (resume) rather than creating a duplicate. */
export async function startRun(
  sql: SqlClient,
  context: Ctx,
  input: { vehicleNumber: string; startOdometer: number | null; clientUuid: string | null },
) {
  if (input.clientUuid) {
    const [existing] = (await sql`
      /* get_run_by_client_uuid */
      select 
      id,
      logistics_user_id as "logisticsUserId",
      run_date as "runDate",
      vehicle_number as "vehicleNumber",
      start_odometer as "startOdometer",
      end_odometer as "endOdometer",
      status,
      started_at as "startedAt",
      ended_at as "endedAt",
      client_uuid as "clientUuid"
 from delivery_runs where client_uuid = ${input.clientUuid}::uuid
    `) as Row[];
    if (existing) return { ...mapRun(existing), existing: true };
  }

  const [active] = (await sql`
    /* get_active_run_today */
    select 
      id,
      logistics_user_id as "logisticsUserId",
      run_date as "runDate",
      vehicle_number as "vehicleNumber",
      start_odometer as "startOdometer",
      end_odometer as "endOdometer",
      status,
      started_at as "startedAt",
      ended_at as "endedAt",
      client_uuid as "clientUuid"
 from delivery_runs
    where logistics_user_id = ${context.userId}::uuid
      and run_date = (now() at time zone 'Asia/Kolkata')::date
      and status = 'active'
    order by started_at desc
    limit 1
  `) as Row[];
  if (active) return { ...mapRun(active), existing: true };

  const [row] = (await sql`
    /* create_delivery_run */
    insert into delivery_runs (
      logistics_user_id, run_date, vehicle_number, start_odometer, status, client_uuid
    ) values (
      ${context.userId}::uuid,
      (now() at time zone 'Asia/Kolkata')::date,
      ${input.vehicleNumber},
      ${input.startOdometer},
      'active',
      ${input.clientUuid}::uuid
    )
    returning 
      id,
      logistics_user_id as "logisticsUserId",
      run_date as "runDate",
      vehicle_number as "vehicleNumber",
      start_odometer as "startOdometer",
      end_odometer as "endOdometer",
      status,
      started_at as "startedAt",
      ended_at as "endedAt",
      client_uuid as "clientUuid"

  `) as Row[];
  return { ...mapRun(row), existing: false };
}

async function loadOwnedRun(sql: SqlClient, context: Ctx, runId: string): Promise<Row> {
  const [run] = (await sql`
    /* get_run_for_owner */
    select 
      id,
      logistics_user_id as "logisticsUserId",
      run_date as "runDate",
      vehicle_number as "vehicleNumber",
      start_odometer as "startOdometer",
      end_odometer as "endOdometer",
      status,
      started_at as "startedAt",
      ended_at as "endedAt",
      client_uuid as "clientUuid"
 from delivery_runs where id = ${runId}::uuid
  `) as Row[];
  if (!run) throw new ApiError("NOT_FOUND", "Delivery run not found.", 404);
  if (str(run.logisticsUserId) !== context.userId) {
    throw new ApiError("NOT_FOUND", "Delivery run not found.", 404);
  }
  return run;
}

export async function endRun(
  sql: SqlClient,
  context: Ctx,
  runId: string,
  endOdometer: number | null,
) {
  const run = await loadOwnedRun(sql, context, runId);
  if (str(run.status) !== "active") {
    // Idempotent: ending an already-ended run just returns it.
    return mapRun(run);
  }
  const startOdo = numOrNull(run.startOdometer);
  if (endOdometer != null && startOdo != null && endOdometer < startOdo) {
    throw new ApiError(
      "INVALID_FIELD",
      `End odometer must be at least the start (${startOdo} km).`,
      422,
    );
  }
  const [row] = (await sql`
    /* end_delivery_run */
    update delivery_runs
    set status = 'ended', end_odometer = ${endOdometer}, ended_at = now(), updated_at = now()
    where id = ${runId}::uuid
    returning 
      id,
      logistics_user_id as "logisticsUserId",
      run_date as "runDate",
      vehicle_number as "vehicleNumber",
      start_odometer as "startOdometer",
      end_odometer as "endOdometer",
      status,
      started_at as "startedAt",
      ended_at as "endedAt",
      client_uuid as "clientUuid"

  `) as Row[];
  return mapRun(row);
}

/** Validate an invoice attached to a delivery stop: it must exist, belong to this
 *  customer, be order-linked, and not already be delivered (the unique index also
 *  guards the last). */
async function assertStopInvoiceValid(sql: SqlClient, invoiceId: string, customerId: string): Promise<void> {
  const [inv] = (await sql`
    /* check_stop_invoice */
    select
      i.id,
      (i.customer_id = ${customerId}::uuid) as "sameCustomer",
      (i.order_id is not null) as "orderLinked",
      exists (select 1 from delivery_run_stops d where d.invoice_id = i.id) as "delivered"
    from invoices i where i.id = ${invoiceId}::uuid and i.doc_status <> 'cancelled'
  `) as Row[];
  if (!inv) throw new ApiError("INVALID_FIELD", "Invoice not found.", 422);
  if (inv.sameCustomer !== true) {
    throw new ApiError("INVALID_FIELD", "That invoice belongs to a different customer.", 422);
  }
  if (inv.orderLinked !== true) {
    throw new ApiError("INVALID_FIELD", "That invoice is not linked to an order.", 422);
  }
  if (inv.delivered === true) {
    throw new ApiError("CONFLICT", "That invoice has already been delivered.", 409);
  }
}

/** Notify the customer's SE that their order reached the customer (only invoices
 *  carry the SE + order link). Inserts the feed row and returns the row + tokens
 *  so the route fires the push via ctx.waitUntil; null when there's no SE. */
async function buildDeliveryPush(sql: SqlClient, invoiceId: string): Promise<DeliveryPush | null> {
  const [meta] = (await sql`
    /* delivery_notify_target */
    select
      coalesce(i.sales_executive_id, cse.id) as "seId",
      i.invoice_number as "invoiceNumber",
      c.legal_name as "customerName"
    from invoices i
    join customers c on c.id = i.customer_id
    left join users cse
      on cse.id = c.created_by
      and exists (
        select 1 from user_roles ur join roles r on r.id = ur.role_id
        where ur.user_id = cse.id and r.code = 'SALES_EXECUTIVE'
      )
    where i.id = ${invoiceId}::uuid
  `) as Row[];
  const seId = strOrNull(meta?.seId);
  if (!seId) return null;
  const title = "Order delivered";
  const body = `${str(meta.customerName)} — invoice ${str(meta.invoiceNumber)} was delivered.`;
  await sql`
    /* insert_delivery_notification */
    insert into se_notifications (user_id, type, title, body, invoice_id)
    values (${seId}::uuid, 'delivery', ${title}, ${body}, ${invoiceId}::uuid)
  `;
  const tokenRows = (await sql`
    /* delivery_push_tokens */
    select token from push_tokens where user_id = ${seId}::uuid
  `) as Row[];
  return {
    tokens: tokenRows.map((t) => str(t.token)).filter(Boolean),
    title,
    body,
  };
}

/** Records a delivery stop (a customer visited). */
export async function addStop(
  sql: SqlClient,
  context: Ctx,
  runId: string,
  input: {
    customerId: string;
    latitude: number | null;
    longitude: number | null;
    clientUuid: string | null;
    /** The invoice this stop delivers (fulfillment link) — optional. */
    invoiceId?: string | null;
  },
) {
  if (input.clientUuid) {
    const [existing] = (await sql`
      /* get_stop_by_client_uuid */
      select id, run_id as "runId", customer_id as "customerId", created_at as "createdAt"
      from delivery_run_stops where client_uuid = ${input.clientUuid}::uuid
    `) as Row[];
    if (existing) {
      return {
        id: str(existing.id),
        runId: str(existing.runId),
        customerId: str(existing.customerId),
        createdAt: str(existing.createdAt),
        existing: true,
        push: null as DeliveryPush | null,
      };
    }
  }

  const run = await loadOwnedRun(sql, context, runId);
  if (str(run.status) !== "active") {
    throw new ApiError("CONFLICT", "This run has already ended.", 409);
  }

  const [customer] = (await sql`
    /* check_stop_customer */
    select id from customers where id = ${input.customerId}::uuid
  `) as Row[];
  if (!customer) throw new ApiError("INVALID_FIELD", "customerId is not a valid customer.", 422);

  // If an invoice is being delivered, it must belong to this customer, be
  // order-linked, and not already delivered (the unique index also guards).
  if (input.invoiceId) await assertStopInvoiceValid(sql, input.invoiceId, input.customerId);

  const [row] = (await sql`
    /* create_delivery_stop */
    insert into delivery_run_stops (
      run_id, customer_id, latitude, longitude, client_uuid, invoice_id
    ) values (
      ${runId}::uuid,
      ${input.customerId}::uuid,
      ${input.latitude},
      ${input.longitude},
      ${input.clientUuid}::uuid,
      ${input.invoiceId ? sql`${input.invoiceId}::uuid` : sql`null`}
    )
    returning id, run_id as "runId", customer_id as "customerId", created_at as "createdAt"
  `) as Row[];

  // The invoice on this stop is now delivered → move its order along the ladder.
  if (input.invoiceId) await recomputeFulfillmentForInvoice(sql, input.invoiceId);

  // Notify the customer's SE that their order reached the customer — only when an
  // invoice is attached (that's what carries the SE + order link).
  const push = input.invoiceId ? await buildDeliveryPush(sql, input.invoiceId) : null;

  return {
    id: str(row.id),
    runId: str(row.runId),
    customerId: str(row.customerId),
    createdAt: str(row.createdAt),
    existing: false,
    push,
  };
}

/**
 * A customer's deliverable invoices: order-linked and not yet delivered — the
 * driver's "to deliver" list for a stop.
 */
// Deliverable = invoiced (order-linked) and not yet delivered. When customerId
// is omitted, returns every deliverable invoice across all customers (the
// logistics app lists these globally and searches by invoice no / customer).
export async function deliverableInvoices(sql: SqlClient, customerId?: string | null) {
  const rows = (await sql`
    /* deliverable_invoices */
    select
      i.id,
      i.invoice_number as "invoiceNumber",
      i.invoice_date as "invoiceDate",
      i.invoice_net_value as "grandTotal",
      i.customer_id as "customerId",
      c.legal_name as "customerName",
      c.customer_code as "customerCode",
      c.address_street as "addressStreet",
      c.address_city as "addressCity",
      c.latitude,
      c.longitude,
      o.order_code as "orderCode"
    from invoices i
    join orders o on o.id = i.order_id
    join customers c on c.id = i.customer_id
    where not exists (select 1 from delivery_run_stops d where d.invoice_id = i.id)
      and i.doc_status <> 'cancelled'
      ${customerId ? sql`and i.customer_id = ${customerId}::uuid` : sql``}
    order by i.invoice_date desc, i.created_at desc
  `) as Row[];
  return rows.map((r) => ({
    id: str(r.id),
    invoiceNumber: str(r.invoiceNumber),
    invoiceDate: str(r.invoiceDate).slice(0, 10),
    grandTotal: numOrNull(r.grandTotal) ?? 0,
    customerId: str(r.customerId),
    customerName: strOrNull(r.customerName),
    customerCode: strOrNull(r.customerCode),
    addressStreet: strOrNull(r.addressStreet),
    addressCity: strOrNull(r.addressCity),
    latitude: numOrNull(r.latitude),
    longitude: numOrNull(r.longitude),
    orderCode: str(r.orderCode),
  }));
}

/** Uploads a run photo (odometer or delivery proof) to R2 + delivery_photos. */
export async function uploadDeliveryPhoto(
  sql: SqlClient,
  bucket: R2Bucket,
  context: Ctx,
  runId: string,
  input: { kind: string; stopId: string | null; file: File; geo?: PhotoGeo },
) {
  if (!VALID_PHOTO_KINDS.has(input.kind)) {
    throw new ApiError(
      "INVALID_FIELD",
      `kind must be one of: ${[...VALID_PHOTO_KINDS].join(", ")}`,
      422,
    );
  }
  if (!ALLOWED_TYPES.has(input.file.type)) {
    throw new ApiError("INVALID_FIELD", "Photo must be a JPEG, PNG or WebP image.", 422);
  }
  if (input.file.size === 0 || input.file.size > MAX_PHOTO_BYTES) {
    throw new ApiError("INVALID_FIELD", "Photo must be a non-empty image under 10 MB.", 422);
  }

  await loadOwnedRun(sql, context, runId); // ownership / existence check

  const extByMime: Record<string, string> = { "image/png": "png", "image/webp": "webp" };
  const ext = extByMime[input.file.type] ?? "jpg";
  const fileKey = `deliveries/${runId}/${crypto.randomUUID()}.${ext}`;
  await bucket.put(fileKey, await input.file.arrayBuffer(), {
    httpMetadata: { contentType: input.file.type },
    storageClass: R2_STORAGE_CLASS,
  });

  const [row] = (await sql`
    /* create_delivery_photo */
    insert into delivery_photos (
      run_id, stop_id, kind, file_key, content_type, size_bytes, uploaded_by,
      latitude, longitude, geocoded_address
    ) values (
      ${runId}::uuid,
      ${input.stopId ? sql`${input.stopId}::uuid` : sql`null`},
      ${input.kind},
      ${fileKey},
      ${input.file.type},
      ${input.file.size},
      ${context.userId}::uuid,
      ${input.geo?.latitude ?? null},
      ${input.geo?.longitude ?? null},
      ${input.geo?.geocodedAddress ?? null}
    )
    returning id, kind, content_type as "contentType", created_at as "createdAt"
  `) as Row[];
  return {
    id: str(row.id),
    kind: str(row.kind),
    contentType: str(row.contentType),
    createdAt: str(row.createdAt),
  };
}

/** The user's active run today (for resuming), with stop count. */
export async function getActiveRun(sql: SqlClient, context: Ctx) {
  const [run] = (await sql`
    /* get_active_run */
    select 
      id,
      logistics_user_id as "logisticsUserId",
      run_date as "runDate",
      vehicle_number as "vehicleNumber",
      start_odometer as "startOdometer",
      end_odometer as "endOdometer",
      status,
      started_at as "startedAt",
      ended_at as "endedAt",
      client_uuid as "clientUuid"
 from delivery_runs
    where logistics_user_id = ${context.userId}::uuid
      and run_date = (now() at time zone 'Asia/Kolkata')::date
      and status = 'active'
    order by started_at desc
    limit 1
  `) as Row[];
  if (!run) return { activeRun: null, stops: [] };

  const stops = (await sql`
    /* list_run_stops */
    select s.id, s.customer_id as "customerId", cu.legal_name as "customerName",
           s.created_at as "createdAt",
           (select count(*) from delivery_photos p where p.stop_id = s.id) as "photoCount"
    from delivery_run_stops s
    left join customers cu on cu.id = s.customer_id
    where s.run_id = ${str(run.id)}::uuid
    order by s.created_at desc
  `) as Row[];

  return {
    activeRun: mapRun(run),
    stops: stops.map((s) => ({
      id: str(s.id),
      customerId: str(s.customerId),
      customerName: strOrNull(s.customerName),
      createdAt: str(s.createdAt),
      photoCount: Number(s.photoCount ?? 0),
    })),
  };
}
