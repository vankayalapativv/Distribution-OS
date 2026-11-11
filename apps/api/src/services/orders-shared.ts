/**
 * Shared foundation for the orders service (architecture audit G-0104): the row
 * mappers, value helpers, list SQL fragments, and shared types used across the
 * orders read (list/detail/paged) and write (create/update/cancel) paths. Split
 * out of the former 1738-line orders.ts so each concern is a smaller, cohesive
 * module. Depends on nothing in orders.ts, so no import cycle.
 */

export interface OrderContext {
  userId: string;
}

/**
 * One order line — an oil (productId + packSizeLitres). Quantity-unit oils carry
 * no pack size or litres.
 */
export interface OrderItemInput {
  productId?: string | null;
  quantityUnits: number;
  packSizeLitres?: number | null;
  segment?: string | null;
  /**
   * Partial-edit only: the id of an existing (already-invoiced) order line this
   * item maps to. Present → the line is UPDATED in place (its billed portion is
   * protected); absent → a brand-new line to insert. Ignored on create.
   */
  orderItemId?: string | null;
}

export interface CreateOrderInput {
  customerId: string;
  salesExecutiveId?: string | null;
  orderDate?: string | null;
  clientUuid?: string | null;
  items: OrderItemInput[];
}

export interface ListOrdersFilters {
  status?: string | null;
  customerId?: string | null;
  /** Filter orders by the customer's registered city. */
  city?: string | null;
  salesExecutiveId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
}

export interface PagedOrdersParams extends ListOrdersFilters {
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
  pageSize?: number | null;
  /**
   * Header dropdown filter. One of the computed fulfillment stages
   * (`ordered` | `invoiced` | `partially_delivered` | `delivered`) — which
   * exclude cancelled orders — or `cancelled` (by order status).
   */
  fulfillment?: string | null;
}

export type Row = Record<string, unknown>;

export function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

export function nullStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return 0;
}

export function nullNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) return Number(v);
  return null;
}

/**
 * The next `ORD-####` code: `max(seq)+1` over existing order codes. Races under
 * concurrent creates, so callers compute it inside a retryOnUniqueViolation and
 * generate the order id per attempt. Shared by the field/web order create path
 * and the backing-order path behind a directly-generated invoice.
 */
export async function nextOrderCode(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>,
): Promise<string> {
  const [codeRow] = (await sql`
    /* next_order_code */
    select coalesce(max(substring(order_code from 5)::int), 0) + 1 as next_seq
    from orders
    where order_code ~ '^ORD-[0-9]+$'
  `) as Array<{ next_seq?: unknown }>;
  return `ORD-${String(num(codeRow?.next_seq ?? 1)).padStart(4, "0")}`;
}

export function mapOrderItemRow(row: Row) {
  return {
    id: str(row.id),
    productId: nullStr(row.productId),
    productName: nullStr(row.productName),
    brand: nullStr(row.brand),
    quantityUnits: num(row.quantityUnits),
    packSizeLitres: nullNum(row.packSizeLitres),
    totalLitres: nullNum(row.totalLitres),
    segment: nullStr(row.segment),
    estimatedUnitPrice: nullNum(row.estimatedUnitPrice),
    estimatedLineValue: nullNum(row.estimatedLineValue),
    hsnCode: nullStr(row.hsnCode),
    gstPercentage: nullNum(row.gstPercentage),
    gstAmount: nullNum(row.gstAmount),
    lineTotal: nullNum(row.lineTotal),
  };
}

export function mapOrderRow(row: Row) {
  return {
    id: str(row.id),
    orderCode: str(row.orderCode),
    orderDate: str(row.orderDate),
    customerId: str(row.customerId),
    customerName: nullStr(row.customerName),
    addressCity: nullStr(row.addressCity),
    customerPhone: nullStr(row.customerPhone),
    segment: nullStr(row.segment),
    customerType: nullStr(row.customerType),
    salesExecutiveId: nullStr(row.salesExecutiveId),
    salesExecutiveName: nullStr(row.salesExecutiveName),
    orderStatus: str(row.orderStatus),
    approvalStatus: str(row.approvalStatus),
    // 'standard' (field/web order) or 'invoice' (auto-created backing order).
    origin: row.origin ? str(row.origin) : "standard",
    discountAmount: nullNum(row.discountAmount),
    totalTaxableAmount: nullNum(row.totalTaxableAmount),
    totalGstAmount: nullNum(row.totalGstAmount),
    totalInvoiceValue: nullNum(row.totalInvoiceValue),
    totalLitres: nullNum(row.totalLitres),
    deliveryAddress: nullStr(row.deliveryAddress),
    deliveryNotes: nullStr(row.deliveryNotes),
    remarks: nullStr(row.remarks),
    createdBy: nullStr(row.createdBy),
    invoiceId: nullStr(row.invoiceId),
    invoiceCode: nullStr(row.invoiceCode),
    // Invoice reference for the list (paged list only; null/0/[] elsewhere).
    firstInvoiceNumber: nullStr(row.firstInvoiceNumber),
    invoiceCount: num(row.invoiceCount),
    invoices: Array.isArray(row.invoices)
      ? (row.invoices as Row[]).map((iv) => ({
          id: str(iv.id),
          number: str(iv.number),
          date: iv.date ? str(iv.date) : null,
        }))
      : [],
    delivered: row.delivered === true,
    // Computed fulfillment ladder (paged list only; null elsewhere).
    fulfillmentStatus: row.fulfillmentStatus ? str(row.fulfillmentStatus) : null,
    // Returned quantity + litres from sales returns (paged list; 0 elsewhere).
    returnedUnits: nullNum(row.returnedUnits) ?? 0,
    returnedLitres: nullNum(row.returnedLitres) ?? 0,
    fullyInvoiced: row.fullyInvoiced === true,
    // Ordered line items (paged list only; [] elsewhere) — for the export.
    items: Array.isArray(row.items) ? (row.items as Row[]).map(mapOrderItemRow) : [],
    createdAt: str(row.createdAt),
  };
}

export function mapProductRow(row: Row) {
  const raw = row.segments;
  const segments: string[] = Array.isArray(raw)
    ? (raw as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  const rawPacks = row.packSizes;
  const packSizes: number[] = Array.isArray(rawPacks)
    ? (rawPacks as unknown[]).map(Number).filter((n) => Number.isFinite(n))
    : [];
  return {
    id: str(row.id),
    productName: str(row.productName),
    brand: row.brand ? str(row.brand) : null,
    unit: row.unit === "quantity" ? "quantity" : "litres",
    segments,
    packSizes,
  };
}

export const FULFILLMENT_STAGES = new Set([
  "ordered",
  "partially_invoiced",
  "invoiced",
  "partially_delivered",
  "delivered",
  "partially_returned",
  "returned",
  "partially_cancelled",
]);

// Per-order sales-return rollup: total returned units + whether every billed
// SKU has been fully returned (net billed 0). `returned` = all billed returned;
// `partially_returned` = some returned but billed units remain. Referenced (as
// `ret`) by FULFILLMENT_CASE + the sort rank. Used in the string-built ORDER_FROM;
// the tagged-template queries inline the same SQL.
export const RETURNS_LATERAL = `
  left join lateral (
    select
      coalesce(sum(coalesce(r.returned, 0)), 0) as returned_units,
      coalesce(sum(coalesce(r.returned_litres, 0)), 0) as returned_litres,
      bool_and(coalesce(a.alloc, 0) - coalesce(r.returned, 0) <= 0.001) as all_billed_returned
    from order_items oir
    left join (
      select ia.order_item_id, sum(ia.quantity_units) as alloc
      from invoice_line_allocations ia
      join invoices iv3 on iv3.id = ia.invoice_id and iv3.approval_status <> 'rejected' and iv3.doc_status <> 'cancelled'
      group by ia.order_item_id
    ) a on a.order_item_id = oir.id
    left join (
      select sri.order_item_id,
             sum(sri.quantity_units) as returned,
             sum(coalesce(sri.litres, 0)) as returned_litres
      from sales_return_items sri group by sri.order_item_id
    ) r on r.order_item_id = oir.id
    where oir.order_id = o.id
      and oir.product_id is not null
  ) ret on true`;

// Computed fulfillment ladder for an order across ALL its invoices/deliveries.
// Shared by the SELECT (display), the sort rank, and the header filter so the
// three never drift. References the `fulf` + `skuinv` lateral aggregates in
// ORDER_FROM. "Fully invoiced" is per-SKU (every ordered oil line billed across
// all invoices) — so an order with anything still to bill reads
// `partially_invoiced`, not `invoiced`.
export const FULFILLMENT_CASE = `
  case
    when o.order_status = 'cancelled' then 'cancelled'
    when coalesce(skuinv.short_closed, false) then 'partially_cancelled'
    when coalesce(ret.returned_units, 0) > 0 and coalesce(ret.all_billed_returned, false) then 'returned'
    when coalesce(ret.returned_units, 0) > 0 then 'partially_returned'
    when fulf.invoice_count = 0 then 'ordered'
    when fulf.delivered_count = 0 and not coalesce(skuinv.fully_invoiced, true) then 'partially_invoiced'
    when fulf.delivered_count = 0 then 'invoiced'
    when fulf.delivered_count >= fulf.invoice_count
         and coalesce(skuinv.fully_invoiced, true) then 'delivered'
    else 'partially_delivered'
  end`;

export const ORDER_LIST_COLUMNS = `
  o.id,
  o.order_code as "orderCode",
  o.order_date as "orderDate",
  o.customer_id as "customerId",
  c.legal_name as "customerName",
  c.address_city as "addressCity",
  c.phone as "customerPhone",
  c.segment,
  c.customer_type as "customerType",
  o.sales_executive_id as "salesExecutiveId",
  se.name as "salesExecutiveName",
  o.order_status as "orderStatus",
  o.approval_status as "approvalStatus",
  -- 'standard' = placed in the field/web; 'invoice' = auto-created behind a
  -- directly-generated invoice (shown with a "From invoice" badge in the list).
  o.origin,
  o.discount_amount as "discountAmount",
  o.total_taxable_amount as "totalTaxableAmount",
  o.total_gst_amount as "totalGstAmount",
  o.total_invoice_value as "totalInvoiceValue",
  o.total_litres as "totalLitres",
  o.delivery_address as "deliveryAddress",
  o.delivery_notes as "deliveryNotes",
  o.remarks,
  o.created_by as "createdBy",
  -- Fulfillment ladder across ALL of the order's invoices (partial delivery):
  --   ordered → invoiced → partially_delivered → delivered.
  ${FULFILLMENT_CASE} as "fulfillmentStatus",
  -- Returned quantity (units) + litres across the order's sales returns, so the
  -- list can show a "−N L returned" note alongside the gross ordered litres.
  coalesce(ret.returned_units, 0) as "returnedUnits",
  coalesce(ret.returned_litres, 0) as "returnedLitres",
  -- Invoice reference for the list: earliest invoice's number, how many invoices
  -- the order has (partial delivery → many), and the full id+number list for the
  -- click-to-open links. Null/0/[] when nothing's billed yet.
  invlist.first_invoice_number as "firstInvoiceNumber",
  coalesce(invlist.invoice_count, 0) as "invoiceCount",
  coalesce(invlist.invoices, '[]'::jsonb) as "invoices",
  -- Whether the order is fully billed (every ordered SKU invoiced, incl. filters)
  -- — gates "Create Invoice".
  coalesce(skuinv.fully_invoiced, true) as "fullyInvoiced",
  -- Ordered line items (per-SKU) for the export/report.
  coalesce(itemsagg.items, '[]'::jsonb) as "items",
  o.created_at as "createdAt"`;

// One row per order: lateral aggregates fold an order's many invoices +
// deliveries into single counts/sums (no row multiplication in count/list).
export const ORDER_FROM = `
  from orders o
  join customers c on c.id = o.customer_id
  left join users se on se.id = o.sales_executive_id
  left join lateral (
    select
      count(iv.id)::int as invoice_count,
      count(iv.id) filter (where ds.id is not null)::int as delivered_count
    from invoices iv
    left join delivery_run_stops ds on ds.invoice_id = iv.id
    where iv.order_id = o.id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
  ) fulf on true
  -- The order's invoices (id + number) for the list "Invoice" column: earliest
  -- first, one clean row per invoice (no delivery-stop fan-out). Drives the
  -- clickable "open PDF" links + the +N-more pick menu.
  left join lateral (
    select
      count(*)::int as invoice_count,
      (array_agg(iv.invoice_number order by iv.invoice_date, iv.created_at))[1] as first_invoice_number,
      jsonb_agg(jsonb_build_object('id', iv.id, 'number', iv.invoice_number, 'date', iv.invoice_date)
        order by iv.invoice_date, iv.created_at) as invoices
    from invoices iv
    where iv.order_id = o.id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
      and iv.invoice_number is not null
  ) invlist on true
  -- Per-SKU "fully invoiced": every billable order line (oil) has its full
  -- ordered quantity allocated across the order's (non-rejected) invoices.
  left join lateral (
    select
      bool_and(coalesce(al.alloc, 0) >= oi.quantity_units - 0.001) as fully_invoiced,
      bool_or(coalesce(oi.cancelled_units, 0) > 0) as short_closed
    from order_items oi
    left join (
      select a.order_item_id, sum(a.quantity_units) as alloc
      from invoice_line_allocations a
      join invoices iv2 on iv2.id = a.invoice_id and iv2.approval_status <> 'rejected' and iv2.doc_status <> 'cancelled'
      group by a.order_item_id
    ) al on al.order_item_id = oi.id
    where oi.order_id = o.id
      and oi.product_id is not null
  ) skuinv on true
  -- Ordered line items folded into one jsonb array per order (for the export).
  left join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', oi.id, 'productId', oi.product_id, 'productName', p.product_name,
      'brand', oi.brand, 'quantityUnits', oi.quantity_units, 'packSizeLitres', oi.pack_size_litres,
      'totalLitres', oi.total_litres, 'segment', oi.segment, 'hsnCode', oi.hsn_code)
      order by oi.created_at), '[]'::jsonb) as items
    from order_items oi
    join products p on p.id = oi.product_id
    where oi.order_id = o.id
  ) itemsagg on true
  ${RETURNS_LATERAL}`;

export const ORDER_SORTS: Record<string, string> = {
  orderCode: "o.order_code",
  orderDate: "o.order_date",
  customerName: "c.legal_name",
  addressCity: "c.address_city",
  salesExecutiveName: "se.name",
  totalLitres: "o.total_litres",
  orderStatus: "o.order_status",
  createdAt: "o.created_at",
  // Funnel rank so ascending reads Ordered → Partially invoiced → Invoiced →
  // Partially delivered → Delivered (same branches as the fulfillmentStatus CASE).
  fulfillment: `
    case
      when o.order_status = 'cancelled' then 5
      when coalesce(skuinv.short_closed, false) then 8
      when coalesce(ret.returned_units, 0) > 0 and coalesce(ret.all_billed_returned, false) then 7
      when coalesce(ret.returned_units, 0) > 0 then 6
      when fulf.invoice_count = 0 then 0
      when fulf.delivered_count = 0 and not coalesce(skuinv.fully_invoiced, true) then 1
      when fulf.delivered_count = 0 then 2
      when fulf.delivered_count >= fulf.invoice_count
           and coalesce(skuinv.fully_invoiced, true) then 4
      else 3
    end`,
};
