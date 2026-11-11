/**
 * Orders read paths (list / paged / detail / invoiceable items / fulfillment
 * summary). Split from the orders god-file (audit G-0104); shares foundation with
 * the write paths via ./orders-shared. Re-exported from ./orders for callers.
 */
import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";
import { resolvePage, resolveSort } from "../lib/pagination";
import {
  type OrderContext,
  type ListOrdersFilters,
  type PagedOrdersParams,
  type Row,
  str,
  nullStr,
  num,
  nullNum,
  mapOrderRow,
  mapOrderItemRow,
  mapProductRow,
  FULFILLMENT_CASE,
  ORDER_LIST_COLUMNS,
  ORDER_FROM,
  ORDER_SORTS,
  FULFILLMENT_STAGES,
} from "./orders-shared";

export async function listSalesExecutives(sql: SqlClient, context: OrderContext) {
  const rows = await sql`
    /* list_sales_executives */
    select
      u.id,
      u.name
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SALES_EXECUTIVE'
      and u.status = 'active'
    order by u.name
  `;
  return rows.map((row: Row) => ({ id: str(row.id), name: str(row.name) }));
}

export async function listProducts(
  sql: SqlClient,
  context: OrderContext,
  filters: { since?: string | null } = {},
) {
  const rows = await sql`
    /* list_products */
    select
      p.id,
      p.product_name as "productName",
      p.brand,
      p.unit,
      coalesce((
        select array_agg(ps.segment order by ps.segment)
        from product_segments ps where ps.product_id = p.id
      ), '{}') as segments,
      coalesce((
        select array_agg(pps.pack_size_litres order by pps.pack_size_litres)
        from product_packs pps where pps.product_id = p.id
      ), '{}') as "packSizes"
    from products p
    where p.status = 'active'
      and (${filters.since ?? null}::text is null or p.updated_at > ${filters.since ?? null}::timestamptz)
    order by p.product_name
    limit 500
  `;
  return rows.map(mapProductRow);
}

export async function listOrders(
  sql: SqlClient,
  context: OrderContext,
  filters: ListOrdersFilters = {},
) {
  const rows = await sql`
    /* list_orders */
    select
      o.id,
      o.order_code as "orderCode",
      o.order_date as "orderDate",
      o.customer_id as "customerId",
      c.legal_name as "customerName",
      o.sales_executive_id as "salesExecutiveId",
      se.name as "salesExecutiveName",
      o.order_status as "orderStatus",
      o.approval_status as "approvalStatus",
      o.discount_amount as "discountAmount",
      o.total_taxable_amount as "totalTaxableAmount",
      o.total_gst_amount as "totalGstAmount",
      o.total_invoice_value as "totalInvoiceValue",
      o.total_litres as "totalLitres",
      o.delivery_address as "deliveryAddress",
      o.delivery_notes as "deliveryNotes",
      o.remarks,
      o.created_by as "createdBy",
      o.created_at as "createdAt",
      -- Fulfillment ladder across ALL the order's invoices/deliveries (same as the
      -- paged list): ordered → partially_invoiced → invoiced → partially_delivered → delivered.
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
      end as "fulfillmentStatus"
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
    left join lateral (
      select
        coalesce(sum(coalesce(r.returned, 0)), 0) as returned_units,
        bool_and(coalesce(a.alloc, 0) - coalesce(r.returned, 0) <= 0.001) as all_billed_returned
      from order_items oir
      left join (
        select ia.order_item_id, sum(ia.quantity_units) as alloc
        from invoice_line_allocations ia
        join invoices iv3 on iv3.id = ia.invoice_id and iv3.approval_status <> 'rejected' and iv3.doc_status <> 'cancelled'
        group by ia.order_item_id
      ) a on a.order_item_id = oir.id
      left join (
        select sri.order_item_id, sum(sri.quantity_units) as returned
        from sales_return_items sri group by sri.order_item_id
      ) r on r.order_item_id = oir.id
      where oir.order_id = o.id
        and oir.product_id is not null
    ) ret on true
    where (${filters.status ?? null}::text is null or o.order_status = ${filters.status ?? null})
      and (${filters.customerId ?? null}::text is null or o.customer_id = ${filters.customerId ?? null}::uuid)
      and (${filters.salesExecutiveId ?? null}::text is null or o.sales_executive_id = ${filters.salesExecutiveId ?? null}::uuid)
      and (${filters.dateFrom ?? null}::text is null or o.order_date >= ${filters.dateFrom ?? null}::date)
      and (${filters.dateTo ?? null}::text is null or o.order_date <= ${filters.dateTo ?? null}::date)
      and (${filters.search ?? null}::text is null
           or o.order_code ilike ${"%" + (filters.search ?? "") + "%"}
           or c.legal_name ilike ${"%" + (filters.search ?? "") + "%"})
    order by o.created_at desc
    limit 200
  `;
  return rows.map(mapOrderRow);
}


/**
 * Server-side filtered/sorted/paginated orders for the web table (the standard
 * table stack — see apps/web/AGENTS.md). The plain `listOrders` (array) stays
 * for mobile + other consumers.
 */
export async function listOrdersPaged(
  sql: SqlClient,
  context: OrderContext,
  opts: PagedOrdersParams,
) {
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (cond: (p: string) => string, value: unknown) => {
    params.push(value);
    conds.push(cond(`$${params.length}`));
  };
  const status = (opts.status ?? "").trim();
  if (status) add((p) => `o.order_status = ${p}`, status);
  const customerId = (opts.customerId ?? "").trim();
  if (customerId) add((p) => `o.customer_id = ${p}::uuid`, customerId);
  const city = (opts.city ?? "").trim();
  if (city) add((p) => `c.address_city = ${p}`, city);
  const salesExecutiveId = (opts.salesExecutiveId ?? "").trim();
  if (salesExecutiveId) add((p) => `o.sales_executive_id = ${p}::uuid`, salesExecutiveId);
  const dateFrom = (opts.dateFrom ?? "").trim();
  if (dateFrom) add((p) => `o.order_date >= ${p}::date`, dateFrom);
  const dateTo = (opts.dateTo ?? "").trim();
  if (dateTo) add((p) => `o.order_date <= ${p}::date`, dateTo);
  const search = (opts.search ?? "").trim();
  if (search) {
    // One box, matched (OR) across every field the client asked for: ORD id,
    // invoice number, customer name, city, sales-exec name and phone. `$N` can be
    // referenced many times, so the text term is a single param reused everywhere.
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    const parts = [
      `o.order_code ilike ${p}`,
      `c.legal_name ilike ${p}`,
      `c.address_city ilike ${p}`,
      `se.name ilike ${p}`,
      `exists (select 1 from invoices iv
                where iv.order_id = o.id
                  and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
                  and iv.invoice_number ilike ${p})`,
    ];
    // Phone: compare digits-only on both sides so "99597 14221", "9959714221"
    // and "+91 99597 14221" all match the stored "+919959714221".
    const digits = search.replace(/\D/g, "");
    if (digits) {
      params.push(`%${digits}%`);
      parts.push(`regexp_replace(c.phone, '[^0-9]', '', 'g') ilike $${params.length}`);
    }
    conds.push(`(${parts.join(" or ")})`);
  }
  // Fulfillment filter. "cancelled" is an order-status bucket; the ladder stages
  // are computed and exclude cancelled orders. Each funnel card (and the header
  // dropdown) filters to exactly one stage — so the rows always match the count.
  const fulfillment = (opts.fulfillment ?? "").trim();
  if (fulfillment === "cancelled") {
    conds.push(`o.order_status = 'cancelled'`);
  } else if (FULFILLMENT_STAGES.has(fulfillment)) {
    conds.push(`o.order_status <> 'cancelled'`);
    add((p) => `(${FULFILLMENT_CASE}) = ${p}`, fulfillment);
  }
  const whereSql = conds.length ? `where ${conds.join(" and ")}` : "";

  const sort = resolveSort(opts.sort, opts.dir, ORDER_SORTS, "createdAt");
  const { limit, offset, page, pageSize } = resolvePage(opts.page, opts.pageSize);

  // Count and page are independent — one parallel batch, not two sequential
  // ~50ms round-trips.
  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* list_orders_paged_count */ select count(*)::int as total ${ORDER_FROM} ${whereSql}`,
      params,
    ),
    sql.query(
      `/* list_orders_paged */
     select ${ORDER_LIST_COLUMNS} ${ORDER_FROM} ${whereSql}
     order by ${sort.expr} ${sort.dir} nulls last, o.created_at desc
     limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);
  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return {
    rows: rows.map(mapOrderRow),
    total: Number(countRow?.total ?? 0),
    page,
    pageSize,
  };
}

/**
 * The most-recent N orders for EVERY customer the SE created, in ONE windowed
 * query (replaces the per-customer N+1 prefetch). Used by the mobile app to cache
 * "Last 5 orders" for all customers on sync so the customer page works offline
 * even for customers never opened. Each returned order carries its `customerId`
 * so the client can group + cache per customer.
 */
export async function listRecentOrdersByCustomerBulk(
  sql: SqlClient,
  context: OrderContext,
  perCustomer = 5,
  since: string | null = null,
) {
  // Server clock → the client stores it as the next delta cursor (no skew).
  const [nowRow] = (await sql`select now() as "serverTime"`) as Row[];
  const serverTime =
    nowRow.serverTime instanceof Date ? nowRow.serverTime.toISOString() : String(nowRow.serverTime);

  const params: unknown[] = [context.userId, perCustomer];
  let changedFilter = "";
  if (since) {
    params.push(since);
    // Delta ($3 = since): a customer's Last-5 changes when an order is
    // created/edited, or its fulfillment moves (invoice uploaded / allocated /
    // delivered). Only those customers are returned; the client upserts them.
    changedFilter = `
      and o.customer_id in (
        select cust.id from customers cust where cust.created_by = $1::uuid and (
          exists (select 1 from orders o2 where o2.customer_id = cust.id
                  and greatest(o2.created_at, coalesce(o2.updated_at, o2.created_at)) > $3::timestamptz)
          or exists (select 1 from invoices i where i.customer_id = cust.id
                  and greatest(i.created_at, coalesce(i.updated_at, i.created_at)) > $3::timestamptz)
          or exists (select 1 from delivery_run_stops ds join invoices iv on iv.id = ds.invoice_id
                  where iv.customer_id = cust.id and ds.created_at > $3::timestamptz)
          or exists (select 1 from invoice_line_allocations a join invoices iv on iv.id = a.invoice_id
                  where iv.customer_id = cust.id and a.created_at > $3::timestamptz)
        )
      )`;
  }

  const rows = (await sql.query(
    `/* bulk_recent_orders */
     select * from (
       select ${ORDER_LIST_COLUMNS},
         row_number() over (partition by o.customer_id order by o.created_at desc) as rn
       ${ORDER_FROM}
       where o.customer_id in (select id from customers where created_by = $1::uuid)${changedFilter}
     ) t
     where t.rn <= $2
     order by t."customerId", t."orderDate" desc`,
    params,
  )) as Row[];
  return { serverTime, orders: rows.map(mapOrderRow) };
}

/**
 * Fulfillment funnel across all non-cancelled orders: how many are Ordered →
 * Invoiced → Delivered, plus aging counts (stuck > 3 days at a stage).
 */
export async function orderFulfillmentSummary(sql: SqlClient) {
  const [row] = (await sql`
    /* order_fulfillment_summary */
    with per_order as (
      select
        o.id,
        o.order_status,
        o.order_date,
        fulf.invoice_count,
        fulf.delivered_count,
        fulf.first_invoice_date,
        coalesce(skuinv.fully_invoiced, true) as fully_invoiced,
        coalesce(skuinv.short_closed, false) as short_closed,
        coalesce(ret.returned_units, 0) as returned_units,
        coalesce(ret.all_billed_returned, false) as all_billed_returned
      from orders o
      left join lateral (
        select
          count(iv.id)::int as invoice_count,
          count(iv.id) filter (where ds.id is not null)::int as delivered_count,
          min(iv.invoice_date) as first_invoice_date
        from invoices iv
        left join delivery_run_stops ds on ds.invoice_id = iv.id
        where iv.order_id = o.id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
      ) fulf on true
      -- Per-SKU fully-invoiced (every ordered oil line billed) +
      -- whether the order was short-closed (any line has a cancelled remainder).
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
      left join lateral (
        select
          coalesce(sum(coalesce(r.returned, 0)), 0) as returned_units,
          bool_and(coalesce(a.alloc, 0) - coalesce(r.returned, 0) <= 0.001) as all_billed_returned
        from order_items oir
        left join (
          select ia.order_item_id, sum(ia.quantity_units) as alloc
          from invoice_line_allocations ia
          join invoices iv3 on iv3.id = ia.invoice_id and iv3.approval_status <> 'rejected' and iv3.doc_status <> 'cancelled'
          group by ia.order_item_id
        ) a on a.order_item_id = oir.id
        left join (
          select sri.order_item_id, sum(sri.quantity_units) as returned
          from sales_return_items sri group by sri.order_item_id
        ) r on r.order_item_id = oir.id
        where oir.order_id = o.id
          and oir.product_id is not null
      ) ret on true
    )
    select
      -- Exclusive stages: cancelled + returns are carved out first so the invoice/
      -- delivery buckets never double-count a returned order.
      count(*) filter (where order_status <> 'cancelled' and not short_closed and returned_units > 0 and all_billed_returned)::int as "returned",
      count(*) filter (where order_status <> 'cancelled' and not short_closed and returned_units > 0 and not all_billed_returned)::int as "partiallyReturned",
      count(*) filter (where order_status <> 'cancelled' and not short_closed and returned_units = 0 and invoice_count = 0)::int as "ordered",
      count(*) filter (
        where order_status <> 'cancelled' and not short_closed and returned_units = 0 and invoice_count > 0 and delivered_count = 0
        and fully_invoiced
      )::int as "invoiced",
      -- Partially invoiced: billed something, more to bill, not delivered.
      count(*) filter (
        where order_status <> 'cancelled' and not short_closed and returned_units = 0 and invoice_count > 0 and delivered_count = 0
        and not fully_invoiced
      )::int as "partiallyInvoiced",
      count(*) filter (
        where order_status <> 'cancelled' and not short_closed and returned_units = 0 and delivered_count > 0
        and delivered_count >= invoice_count and fully_invoiced
      )::int as "delivered",
      count(*) filter (
        where order_status <> 'cancelled' and not short_closed and returned_units = 0 and delivered_count > 0
        and (delivered_count < invoice_count or not fully_invoiced)
      )::int as "partiallyDelivered",
      count(*) filter (
        where order_status <> 'cancelled' and not short_closed and invoice_count = 0
        and order_date <= (now() at time zone 'Asia/Kolkata')::date - 3
      )::int as "unInvoicedAging",
      count(*) filter (
        where order_status <> 'cancelled' and not short_closed and invoice_count > 0 and delivered_count = 0
        and not fully_invoiced
        and first_invoice_date <= (now() at time zone 'Asia/Kolkata')::date - 3
      )::int as "partiallyInvoicedAging",
      count(*) filter (
        where order_status <> 'cancelled' and not short_closed and invoice_count > 0 and delivered_count < invoice_count
        and first_invoice_date <= (now() at time zone 'Asia/Kolkata')::date - 3
      )::int as "unDeliveredAging",
      -- Short-closed orders (un-invoiced remainder cancelled): its own bucket,
      -- carved out of every non-cancelled stage above via not short_closed.
      count(*) filter (where order_status <> 'cancelled' and short_closed)::int as "partiallyCancelled",
      -- Cancelled orders (its own bucket, carved out of every stage above).
      count(*) filter (where order_status = 'cancelled')::int as "cancelled"
    from per_order
  `) as Row[];
  return {
    returned: num(row?.returned),
    partiallyReturned: num(row?.partiallyReturned),
    ordered: num(row?.ordered),
    invoiced: num(row?.invoiced),
    partiallyInvoiced: num(row?.partiallyInvoiced),
    delivered: num(row?.delivered),
    partiallyDelivered: num(row?.partiallyDelivered),
    partiallyCancelled: num(row?.partiallyCancelled),
    cancelled: num(row?.cancelled),
    unInvoicedAging: num(row?.unInvoicedAging),
    partiallyInvoicedAging: num(row?.partiallyInvoicedAging),
    unDeliveredAging: num(row?.unDeliveredAging),
  };
}

export async function getOrderById(
  sql: SqlClient,
  context: OrderContext,
  id: string,
) {
  const rows = await sql`
    /* get_order_by_id */
    select
      o.id,
      o.order_code as "orderCode",
      o.order_date as "orderDate",
      o.customer_id as "customerId",
      c.legal_name as "customerName",
      o.sales_executive_id as "salesExecutiveId",
      se.name as "salesExecutiveName",
      o.order_status as "orderStatus",
      o.approval_status as "approvalStatus",
      o.discount_amount as "discountAmount",
      o.total_taxable_amount as "totalTaxableAmount",
      o.total_gst_amount as "totalGstAmount",
      o.total_invoice_value as "totalInvoiceValue",
      o.total_litres as "totalLitres",
      o.delivery_address as "deliveryAddress",
      o.delivery_notes as "deliveryNotes",
      o.remarks,
      o.cancellation_note as "cancellationNote",
      o.created_by as "createdBy",
      o.created_at as "createdAt"
    from orders o
    join customers c on c.id = o.customer_id
    left join users se on se.id = o.sales_executive_id
    where o.id = ${id}::uuid
    limit 1
  `;

  if (rows.length === 0) {
    throw new ApiError("NOT_FOUND", "Order not found.", 404);
  }

  const itemRows = await sql`
    /* get_order_items */
    select
      oi.id,
      oi.product_id as "productId",
      p.product_name as "productName",
      oi.brand,
      oi.quantity_units as "quantityUnits",
      oi.pack_size_litres as "packSizeLitres",
      oi.total_litres as "totalLitres",
      oi.segment,
      oi.estimated_unit_price as "estimatedUnitPrice",
      oi.estimated_line_value as "estimatedLineValue",
      oi.hsn_code as "hsnCode",
      oi.gst_percentage as "gstPercentage",
      oi.gst_amount as "gstAmount",
      oi.line_total as "lineTotal"
    from order_items oi
    join products p on p.id = oi.product_id
    where oi.order_id = ${id}::uuid
    order by oi.created_at
  `;

  // Shipments: every invoice on this order (partial delivery → many), each with
  // its delivery status. Ordered oldest-first so the timeline reads top-down.
  const shipmentRows = (await sql`
    /* get_order_shipments */
    select
      i.id as "invoiceId",
      i.invoice_number as "invoiceCode",
      i.invoice_date as "invoiceDate",
      i.invoice_net_value as "invoiceTotal",
      i.outstanding_amount as "invoiceOutstanding",
      i.total_litres as "oilLitres",
      i.created_at as "invoicedAt",
      i.doc_status as "docStatus",
      drs.id as "deliveryStopId",
      drs.created_at as "deliveredAt"
    from invoices i
    left join delivery_run_stops drs on drs.invoice_id = i.id
    where i.order_id = ${id}::uuid and i.approval_status <> 'rejected'
    order by i.invoice_date, i.created_at
  `) as Row[];

  // Cancelled invoices are included so the order trail still shows "this invoice
  // was cancelled" (its stock was reversed and the order re-opened). They never
  // count toward the fulfillment stage — the trail passes only the active ones.
  const shipments = shipmentRows.map((s) => ({
    id: str(s.invoiceId),
    code: str(s.invoiceCode),
    date: str(s.invoiceDate).slice(0, 10),
    total: num(s.invoiceTotal),
    outstanding: num(s.invoiceOutstanding),
    oilLitres: num(s.oilLitres),
    invoicedAt: str(s.invoicedAt),
    cancelled: str(s.docStatus) === "cancelled",
    delivered: s.deliveryStopId != null,
    deliveredAt: s.deliveredAt != null ? str(s.deliveredAt) : null,
  }));

  // Per-SKU progress: ordered vs invoiced-so-far (from allocations) → remaining.
  const progressRows = (await sql`
    /* get_order_sku_progress */
    select
      oi.id,
      coalesce(p.product_name, '') as "label",
      -- HSN drives invoice matching: the product's own HSN.
      p.hsn_code as "hsnCode",
      oi.pack_size_litres as "packSizeLitres",
      oi.quantity_units as "orderedUnits",
      coalesce(oi.cancelled_units, 0)::numeric as "cancelledUnits",
      coalesce(al.alloc, 0)::numeric as "invoicedUnits",
      coalesce(rt.returned, 0)::numeric as "returnedUnits"
    from order_items oi
    join products p on p.id = oi.product_id
    left join (
      select a.order_item_id, sum(a.quantity_units) as alloc
      from invoice_line_allocations a
      join invoices iv on iv.id = a.invoice_id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
      group by a.order_item_id
    ) al on al.order_item_id = oi.id
    left join (
      select sri.order_item_id, sum(sri.quantity_units) as returned
      from sales_return_items sri
      group by sri.order_item_id
    ) rt on rt.order_item_id = oi.id
    where oi.order_id = ${id}::uuid and oi.product_id is not null
    order by oi.created_at
  `) as Row[];

  const skuProgress = progressRows.map((r) => {
    const ordered = num(r.orderedUnits);
    const invoiced = num(r.invoicedUnits);
    return {
      orderItemId: str(r.id),
      label: str(r.label),
      packSizeLitres: nullNum(r.packSizeLitres),
      // After a short-close, `quantity_units` (→ orderedUnits) is shrunk to the
      // invoiced amount and the cancelled remainder lives in cancelledUnits, so
      // the ORIGINAL ordered quantity is orderedUnits + cancelledUnits.
      orderedUnits: ordered,
      cancelledUnits: num(r.cancelledUnits),
      invoicedUnits: invoiced,
      remainingUnits: Math.max(0, ordered - invoiced),
      returnedUnits: num(r.returnedUnits),
    };
  });

  // Backward-compat single-invoice trail (first ACTIVE shipment + its delivery) —
  // a cancelled invoice must not stand in as "the" invoice here.
  const first = shipments.find((s) => !s.cancelled) ?? null;
  const fulfillment = {
    invoice: first
      ? {
          id: first.id,
          code: first.code,
          date: first.date,
          total: first.total,
          outstanding: first.outstanding,
          invoicedAt: first.invoicedAt,
        }
      : null,
    delivery: first?.delivered ? { deliveredAt: first.deliveredAt ?? "" } : null,
  };

  return {
    ...mapOrderRow(rows[0]),
    items: itemRows.map(mapOrderItemRow),
    fulfillment,
    shipments,
    skuProgress,
  };
}

/**
 * Per-SKU invoiceable state for an order (oils) — ordered,
 * already invoiced (from allocations), and remaining. Feeds the Create-Invoice
 * form so each line is capped at the order's remaining and can't over-bill.
 */
export async function listOrderInvoiceableItems(
  sql: SqlClient,
  _context: OrderContext,
  orderId: string,
  opts: { excludeInvoiceId?: string } = {},
) {
  const [order] = (await sql`
    /* invoiceable_order_status */
    select o.order_status as "orderStatus", c.legal_name as "customerName", c.phone as "customerPhone"
    from orders o join customers c on c.id = o.customer_id
    where o.id = ${orderId}::uuid limit 1
  `) as Row[];
  if (!order) throw new ApiError("NOT_FOUND", "Order not found.", 404);

  const rows = (await sql`
    /* order_invoiceable_items */
    select
      oi.id,
      coalesce(p.product_name, '') as "label",
      -- HSN drives invoice matching: the product's own HSN.
      p.hsn_code as "hsnCode",
      oi.pack_size_litres as "packSizeLitres",
      oi.quantity_units as "orderedUnits",
      coalesce(al.alloc, 0)::numeric as "invoicedUnits"
    from order_items oi
    join products p on p.id = oi.product_id
    left join (
      select a.order_item_id, sum(a.quantity_units) as alloc
      from invoice_line_allocations a
      join invoices iv on iv.id = a.invoice_id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
        ${opts.excludeInvoiceId ? sql`and iv.id <> ${opts.excludeInvoiceId}::uuid` : sql``}
      group by a.order_item_id
    ) al on al.order_item_id = oi.id
    where oi.order_id = ${orderId}::uuid and oi.product_id is not null
    order by oi.created_at
  `) as Row[];

  return {
    orderStatus: str(order.orderStatus),
    customerName: nullStr(order.customerName),
    customerPhone: nullStr(order.customerPhone),
    items: rows.map((r) => {
      const ordered = num(r.orderedUnits);
      const invoiced = num(r.invoicedUnits);
      return {
        orderItemId: str(r.id),
        label: str(r.label),
        hsnCode: nullStr(r.hsnCode),
        packSizeLitres: nullNum(r.packSizeLitres),
        orderedUnits: ordered,
        invoicedUnits: invoiced,
        remainingUnits: Math.max(0, ordered - invoiced),
      };
    }),
  };
}
