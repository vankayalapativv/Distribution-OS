import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { resolveSort } from "../lib/pagination";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function nullStr(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}


function mapInvoice(row: Row) {
  return {
    id: str(row.id),
    invoiceNumber: str(row.invoiceNumber),
    invoiceDate: str(row.invoiceDate).slice(0, 10),
    customerId: str(row.customerId),
    customerName: nullStr(row.customerName),
    customerCity: nullStr(row.customerCity),
    orderId: nullStr(row.orderId),
    orderCode: nullStr(row.orderCode),
    salesExecutiveId: nullStr(row.salesExecutiveId),
    salesExecutiveName: nullStr(row.salesExecutiveName),
    station: nullStr(row.station),
    partyPhone: nullStr(row.partyPhone),
    totalLitres: num(row.totalLitres),
    taxableValue: num(row.taxableValue),
    gstAmount: num(row.gstAmount),
    grandTotal: num(row.grandTotal),
    amountCollected: num(row.amountCollected),
    outstandingAmount: num(row.outstandingAmount),
    paymentStatus: str(row.paymentStatus),
    invoiceSource: nullStr(row.invoiceSource),
    docStatus: row.docStatus == null ? null : str(row.docStatus),
    createdAt: str(row.createdAt),
  };
}

/** Fire Expo push messages (caller wraps in ctx.waitUntil). Best-effort. */
export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (tokens.length === 0) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      tokens.map((to) => ({ to, title, body, data, sound: "default" })),
    ),
  }).catch(() => undefined);
}

export interface ListInvoicesFilters {
  q: string | null;
  customerId: string | null;
  sort?: string | null;
  dir?: string | null;
  page: number;
  pageSize: number;
}

/** Whitelisted sort columns for the invoices table (keys = client accessorKeys). */
const INVOICE_SORTS: Record<string, string> = {
  invoiceNumber: "i.invoice_number",
  invoiceDate: "i.invoice_date",
  customerName: "c.legal_name",
  totalLitres: "i.total_litres",
  taxableValue: "i.taxable_value",
  grandTotal: "i.invoice_net_value",
  outstandingAmount: "i.outstanding_amount",
};

export async function listInvoices(sql: SqlClient, filters: ListInvoicesFilters) {
  const offset = (filters.page - 1) * filters.pageSize;
  const like = filters.q ? `%${filters.q}%` : null;
  const s = resolveSort(filters.sort, filters.dir, INVOICE_SORTS, "invoiceDate");

  const rows = (await sql.query(
    `/* list_invoices */
    select
      i.id,
      i.invoice_number as "invoiceNumber",
      i.invoice_date as "invoiceDate",
      i.customer_id as "customerId",
      c.legal_name as "customerName",
      c.address_city as "customerCity",
      i.order_id as "orderId",
      o.order_code as "orderCode",
      i.sales_executive_id as "salesExecutiveId",
      u.name as "salesExecutiveName",
      i.station,
      i.party_phone as "partyPhone",
      i.total_litres as "totalLitres",
      i.taxable_value as "taxableValue",
      i.gst_amount as "gstAmount",
      i.invoice_net_value as "grandTotal",
      i.amount_collected as "amountCollected",
      i.outstanding_amount as "outstandingAmount",
      i.payment_status as "paymentStatus",
      i.invoice_source as "invoiceSource",
      i.doc_status as "docStatus",
      i.created_at as "createdAt",
      count(*) over()::int as "total"
    from invoices i
    join customers c on c.id = i.customer_id
    left join orders o on o.id = i.order_id
    left join users u on u.id = i.sales_executive_id
    where ($1::text is null or i.invoice_number ilike $1 or c.legal_name ilike $1 or i.party_phone ilike $1)
      and ($2::uuid is null or i.customer_id = $2::uuid)
    order by ${s.expr} ${s.dir} nulls last, i.created_at desc
    limit $3 offset $4`,
    [like, filters.customerId, filters.pageSize, offset],
  )) as Row[];

  return {
    invoices: rows.map(mapInvoice),
    total: rows.length > 0 ? num(rows[0].total) : 0,
  };
}

export async function getInvoice(sql: SqlClient, invoiceId: string) {
  const [row] = await sql`
    /* get_invoice */
    select
      i.id,
      i.invoice_number as "invoiceNumber",
      i.invoice_date as "invoiceDate",
      i.customer_id as "customerId",
      c.legal_name as "customerName",
      i.order_id as "orderId",
      o.order_code as "orderCode",
      i.sales_executive_id as "salesExecutiveId",
      u.name as "salesExecutiveName",
      i.station,
      i.party_phone as "partyPhone",
      i.total_litres as "totalLitres",
      i.taxable_value as "taxableValue",
      i.gst_amount as "gstAmount",
      i.invoice_net_value as "grandTotal",
      i.amount_collected as "amountCollected",
      i.outstanding_amount as "outstandingAmount",
      i.payment_status as "paymentStatus",
      i.created_at as "createdAt",
      i.line_items as "lineItems"
    from invoices i
    join customers c on c.id = i.customer_id
    left join orders o on o.id = i.order_id
    left join users u on u.id = i.sales_executive_id
    where i.id = ${invoiceId}::uuid
    limit 1
  ` as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Invoice not found.", 404);
  return { ...mapInvoice(row), lineItems: row.lineItems ?? [] };
}

/** SE notification feed (newest first). */
export async function listMyNotifications(sql: SqlClient, context: { userId: string }) {
  const rows = await sql`
    /* list_my_notifications */
    select
      n.id,
      n.type,
      n.title,
      n.body,
      n.invoice_id as "invoiceId",
      n.customer_id as "customerId",
      n.created_at as "createdAt",
      n.read_at as "readAt"
    from se_notifications n
    where n.user_id = ${context.userId}::uuid
    order by n.created_at desc
    limit 100
  ` as Row[];
  return rows.map((r) => ({
    id: str(r.id),
    type: str(r.type),
    title: str(r.title),
    body: nullStr(r.body),
    invoiceId: nullStr(r.invoiceId),
    customerId: nullStr(r.customerId),
    createdAt: str(r.createdAt),
    readAt: nullStr(r.readAt),
  }));
}

export async function markNotificationRead(
  sql: SqlClient,
  context: { userId: string },
  notificationId: string,
) {
  const [row] = await sql`
    /* mark_notification_read */
    update se_notifications
    set read_at = coalesce(read_at, now())
    where id = ${notificationId}::uuid and user_id = ${context.userId}::uuid
    returning id
  ` as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Notification not found.", 404);
  return { id: str(row.id) };
}

/** Delete one of the SE's own notifications. */
export async function deleteNotification(
  sql: SqlClient,
  context: { userId: string },
  notificationId: string,
) {
  const [row] = await sql`
    /* delete_notification */
    delete from se_notifications
    where id = ${notificationId}::uuid and user_id = ${context.userId}::uuid
    returning id
  ` as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Notification not found.", 404);
  return { id: str(row.id) };
}

/** Clear the SE's entire notification feed. */
export async function clearNotifications(sql: SqlClient, context: { userId: string }) {
  const rows = (await sql`
    /* clear_notifications */
    delete from se_notifications where user_id = ${context.userId}::uuid
    returning id
  `) as Row[];
  return { deleted: rows.length };
}

/**
 * Retention cleanup: delete notifications older than 6 days. Self-gates to run
 * about once every 6 days via a system_settings marker, so the 3-minute cron
 * doesn't run it constantly. Returns the number deleted (0 when skipped).
 */
export async function cleanupOldNotifications(sql: SqlClient): Promise<{ deleted: number }> {
  const [gate] = (await sql`
    /* notifications_cleanup_gate */
    insert into system_flags (key, value)
    values ('notifications_cleanup_last_run', now()::text)
    on conflict (key) do update set value = now()::text
      where system_flags.value::timestamptz < now() - interval '6 days'
    returning key
  `) as Row[];
  if (!gate) return { deleted: 0 }; // ran within the last 6 days — skip
  const rows = (await sql`
    /* cleanup_old_notifications */
    delete from se_notifications where created_at < now() - interval '6 days'
    returning id
  `) as Row[];
  return { deleted: rows.length };
}

/** Upsert this device's Expo push token. */
export async function registerPushToken(
  sql: SqlClient,
  context: { userId: string },
  token: string,
  platform: string | null,
  device?: { manufacturer?: string | null; model?: string | null },
) {
  const manufacturer = device?.manufacturer ?? null;
  const model = device?.model ?? null;
  await sql`
    /* upsert_push_token */
    insert into push_tokens (user_id, token, platform, manufacturer, model)
    values (${context.userId}::uuid, ${token}, ${platform}, ${manufacturer}, ${model})
    on conflict (token) do update set
      user_id = excluded.user_id,
      platform = excluded.platform,
      -- Keep the last known device: a later call without device info (older app
      -- build) shouldn't wipe what we already have.
      manufacturer = coalesce(excluded.manufacturer, push_tokens.manufacturer),
      model = coalesce(excluded.model, push_tokens.model),
      updated_at = now()
  `;
  return { registered: true };
}
