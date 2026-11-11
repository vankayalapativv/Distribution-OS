import type { SqlClient } from "../lib/db";

/**
 * Order fulfillment ladder — the stored `orders.fulfillment_status` (migration
 * 0074). One authoritative stage per order, kept in sync by recomputing after
 * every change that can move an order along the ladder: order create/edit/cancel,
 * invoice create/edit/reject/delete, delivery-stop add/remove, and sales-return
 * create/edit/delete.
 *
 * The derivation is IDENTICAL to `FULFILLMENT_CASE` in ./orders.ts (the live
 * display) and to the backfill in migration 0074 — the three MUST stay in sync.
 * Derived from ground truth (invoices + delivery_run_stops + per-SKU
 * invoice_line_allocations + sales_return_items; rejected invoices excluded), so
 * it is idempotent and safe to run any number of times.
 */

export const FULFILLMENT_STATUSES = [
  "ordered",
  "partially_invoiced",
  "invoiced",
  "partially_delivered",
  "delivered",
  "partially_returned",
  "returned",
  "partially_cancelled",
  "cancelled",
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

/**
 * Recompute + persist `fulfillment_status` for the given orders in one statement.
 * No-op on an empty list. Does NOT bump `updated_at` (this is a derived-field
 * refresh, not a business edit — avoids spurious sync churn).
 */
export async function recomputeOrdersFulfillment(
  sql: SqlClient,
  orderIds: string[],
): Promise<void> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (ids.length === 0) return;
  await sql`
    /* recompute_orders_fulfillment */
    update orders o
    set fulfillment_status = x.fs
    from (
      select
        o2.id,
        case
          when o2.order_status = 'cancelled' then 'cancelled'
          when coalesce(skuinv.short_closed, false) then 'partially_cancelled'
          when coalesce(ret.returned_units, 0) > 0 and coalesce(ret.all_billed_returned, false) then 'returned'
          when coalesce(ret.returned_units, 0) > 0 then 'partially_returned'
          when fulf.invoice_count = 0 then 'ordered'
          when fulf.delivered_count = 0 and not coalesce(skuinv.fully_invoiced, true) then 'partially_invoiced'
          when fulf.delivered_count = 0 then 'invoiced'
          when fulf.delivered_count >= fulf.invoice_count and coalesce(skuinv.fully_invoiced, true) then 'delivered'
          else 'partially_delivered'
        end as fs
      from orders o2
      left join lateral (
        select
          count(iv.id)::int as invoice_count,
          count(iv.id) filter (where ds.id is not null)::int as delivered_count
        from invoices iv
        left join delivery_run_stops ds on ds.invoice_id = iv.id
        where iv.order_id = o2.id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
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
        where oi.order_id = o2.id
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
        where oir.order_id = o2.id
          and oir.product_id is not null
      ) ret on true
      where o2.id = any(${ids}::uuid[])
    ) x
    where o.id = x.id
  `;
}

/** Convenience: recompute one order. */
export async function recomputeOrderFulfillment(sql: SqlClient, orderId: string): Promise<void> {
  await recomputeOrdersFulfillment(sql, [orderId]);
}

/** Recompute the order an invoice belongs to (no-op for a legacy invoice with no order link). */
export async function recomputeFulfillmentForInvoice(sql: SqlClient, invoiceId: string): Promise<void> {
  const rows = await sql`
    /* fulfillment_order_for_invoice */
    select order_id as "orderId" from invoices where id = ${invoiceId}::uuid and order_id is not null
  `;
  const orderId = rows[0]?.orderId as string | undefined;
  if (orderId) await recomputeOrdersFulfillment(sql, [orderId]);
}

/** Recompute every order touched by a sales return (via its returned order lines). */
export async function recomputeFulfillmentForSalesReturn(sql: SqlClient, salesReturnId: string): Promise<void> {
  const rows = await sql`
    /* fulfillment_orders_for_sales_return */
    select distinct oi.order_id as "orderId"
    from sales_return_items sri
    join order_items oi on oi.id = sri.order_item_id
    where sri.sales_return_id = ${salesReturnId}::uuid and oi.order_id is not null
  `;
  await recomputeOrdersFulfillment(sql, rows.map((r) => r.orderId as string));
}
