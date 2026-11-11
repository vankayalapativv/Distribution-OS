import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";
import { isUniqueViolation, retryOnUniqueViolation } from "../lib/pg-errors";
import { recomputeOrderFulfillment } from "./fulfillment";
import {
  type OrderContext,
  type OrderItemInput,
  type CreateOrderInput,
  type Row,
  str,
  nullStr,
  num,
  mapOrderRow,
  mapOrderItemRow,
  nextOrderCode,
} from "./orders-shared";
import { getOrderById } from "./orders-queries";

// The orders service is split (audit G-0104): read paths in ./orders-queries, the
// shared foundation (types/helpers/mappers/SQL) in ./orders-shared. This module
// keeps the write paths (create/update/cancel) and re-exports the rest so callers
// of ../services/orders are unchanged.
export * from "./orders-queries";
export type {
  OrderContext,
  OrderItemInput,
  CreateOrderInput,
  ListOrdersFilters,
  PagedOrdersParams,
} from "./orders-shared";


interface PreparedOrderItems {
  enrichedItems: {
    productId: string;
    quantityUnits: number;
    // null for quantity-unit products (sold by piece, no pack size).
    packSizeLitres: number | null;
    totalLitres: number | null;
    segment: string | null;
    brand: string | null;
  }[];
  totalLitres: number;
}

/**
 * Validate + enrich order line items (oils), snapshotting brand and computing
 * the litre total. Shared by createOrder and updateOrder so both stay in
 * lock-step.
 */
export async function prepareOrderItems(
  sql: SqlClient,
  items: OrderItemInput[],
): Promise<PreparedOrderItems> {
  for (const item of items) {
    if (!item.productId) {
      throw new ApiError("INVALID_FIELD", "Each order item needs a productId.", 422);
    }
  }

  const oilInputs = items.filter((i) => i.productId);

  const productIds = oilInputs.map((i) => i.productId);
  const productRows = productIds.length
    ? await sql`
        /* get_products_for_order */
        select p.id, p.brand, p.unit
        from products p
        where p.id = any(${productIds}::uuid[])
          and p.status = 'active'
      `
    : [];
  const productById = new Map(
    productRows.map((p) => [
      str(p.id),
      { brand: nullStr(p.brand), unit: p.unit === "quantity" ? "quantity" : "litres" },
    ]),
  );

  const enrichedItems = oilInputs.map((item) => {
    const product = productById.get(item.productId!);
    if (!product) {
      throw new ApiError("INVALID_FIELD", `Product ${item.productId} not found.`, 422);
    }
    const qty = item.quantityUnits;
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ApiError(
        "INVALID_FIELD",
        `Quantity must be a whole number of 1 or more.`,
        422,
      );
    }
    // Quantity-unit products carry no pack size / litres — just a piece count.
    if (product.unit === "quantity") {
      return {
        productId: item.productId!,
        quantityUnits: qty,
        packSizeLitres: null,
        totalLitres: null,
        segment: item.segment ?? null,
        brand: product.brand,
      };
    }
    const packSizeLitres = item.packSizeLitres ?? 0;
    if (packSizeLitres <= 0) {
      throw new ApiError("INVALID_FIELD", "A pack size is required for this product.", 422);
    }
    return {
      productId: item.productId!,
      quantityUnits: qty,
      packSizeLitres,
      totalLitres: qty * packSizeLitres,
      segment: item.segment ?? null,
      brand: product.brand,
    };
  });

  // Quantity-unit products carry no litres — order totals stay litres-only.
  const totalLitres = enrichedItems.reduce((s, i) => s + (i.totalLitres ?? 0), 0);

  return { enrichedItems, totalLitres };
}

/**
 * The SE who owns a customer (customers.created_by), but only when that user
 * actually holds the SALES_EXECUTIVE role. Used to auto-attribute an order or
 * collection that an office user (e.g. a Super Admin on mobile) records for a
 * customer — every customer belongs to exactly one SE, so no picker is needed.
 */
export async function customerOwnerSE(sql: SqlClient, customerId: string): Promise<string | null> {
  const [row] = await sql`
    /* customer_owner_se */
    select c.created_by as "seId"
    from customers c
    where c.id = ${customerId}::uuid
      and exists (
        select 1 from user_roles ur join roles r on r.id = ur.role_id
        where ur.user_id = c.created_by and r.code = 'SALES_EXECUTIVE'
      )
    limit 1
  `;
  return row ? str(row.seId) : null;
}

/**
 * Fetch an already-created order (with its items) by clientUuid, mapped for the
 * create-order response with `existing: true`, or null when none. Shared by the
 * up-front idempotent-replay check AND the concurrent-race recovery below.
 */
async function existingOrderByClientUuid(sql: SqlClient, clientUuid: string) {
  const [existingOrder] = await sql`
    /* get_order_by_client_uuid */
    select
      id,
      order_code as "orderCode",
      order_date as "orderDate",
      customer_id as "customerId",
      sales_executive_id as "salesExecutiveId",
      order_status as "orderStatus",
      approval_status as "approvalStatus",
      discount_amount as "discountAmount",
      total_taxable_amount as "totalTaxableAmount",
      total_gst_amount as "totalGstAmount",
      total_invoice_value as "totalInvoiceValue",
      total_litres as "totalLitres",
      delivery_address as "deliveryAddress",
      delivery_notes as "deliveryNotes",
      remarks,
      created_by as "createdBy",
      created_at as "createdAt"
    from orders
    where client_uuid = ${clientUuid}::uuid
  `;
  if (!existingOrder) return null;

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
    where oi.order_id = ${str(existingOrder.id)}
    order by oi.created_at
  `;

  return {
    ...mapOrderRow({ ...existingOrder, customerName: null }),
    items: itemRows.map(mapOrderItemRow),
    existing: true,
  };
}

export async function createOrder(
  sql: SqlClient,
  context: OrderContext,
  input: CreateOrderInput,
) {
  if (!input.items || input.items.length === 0) {
    throw new ApiError("INVALID_FIELD", "Order must have at least one item.", 422);
  }

  if (!input.customerId) {
    throw new ApiError("INVALID_FIELD", "customerId is required.", 422);
  }

  // Idempotent replay: a mobile client retrying an offline-queued order
  // sends the same clientUuid — return the already-created order.
  if (input.clientUuid) {
    const existing = await existingOrderByClientUuid(sql, input.clientUuid);
    if (existing) return existing;
  }

  const { enrichedItems, totalLitres } = await prepareOrderItems(sql, input.items);

  // Attribute to the customer's owning SE when the creator didn't name one (a
  // Super Admin recording an order for a customer). An SE creating their own
  // order already has salesExecutiveId forced to self upstream, so this only
  // fills the office-role gap. Not racy → computed once, outside the retry.
  const salesExecutiveId =
    input.salesExecutiveId ?? (await customerOwnerSE(sql, input.customerId));

  // Header + all line items in ONE atomic round-trip (architecture audit G-0402).
  // The ORD-#### code is max(seq)+1, which races under concurrent creates, so code
  // generation + the atomic insert are retried on an order_code collision; the id
  // is generated per attempt so the item inserts reference it in the same txn.
  const runInsert = async (): Promise<Row[][]> => {
    const orderCode = await nextOrderCode(sql);
    const orderId = crypto.randomUUID();
    const statements = [
    sql`
      /* create_order */
      insert into orders (
        id, order_code, order_date, customer_id, sales_executive_id,
        total_litres, order_status, approval_status, created_by, client_uuid
      )
      values (
        ${orderId}::uuid,
        ${orderCode},
        coalesce(${input.orderDate ?? null}::date, (now() at time zone 'Asia/Kolkata')::date),
        ${input.customerId},
        ${salesExecutiveId ?? null},
        ${totalLitres},
        'approved',
        'approved',
        ${context.userId},
        ${input.clientUuid ?? null}::uuid
      )
      returning
        id, order_code as "orderCode", order_date as "orderDate",
        customer_id as "customerId", sales_executive_id as "salesExecutiveId",
        order_status as "orderStatus", approval_status as "approvalStatus",
        discount_amount as "discountAmount", total_taxable_amount as "totalTaxableAmount",
        total_gst_amount as "totalGstAmount", total_invoice_value as "totalInvoiceValue",
        total_litres as "totalLitres", delivery_address as "deliveryAddress",
        delivery_notes as "deliveryNotes", remarks, created_by as "createdBy",
        created_at as "createdAt"
    `,
    // Oil lines (brand snapshotted from the product).
    ...enrichedItems.map((item) => sql`
      /* create_order_item */
      insert into order_items (order_id, product_id, brand, quantity_units, pack_size_litres, total_litres, segment)
      values (${orderId}::uuid, ${item.productId}, ${item.brand}, ${item.quantityUnits}, ${item.packSizeLitres}, ${item.totalLitres}, ${item.segment})
    `),
    ];
    return (await sql.transaction(statements)) as Row[][];
  };

  let results: Row[][];
  try {
    results = await retryOnUniqueViolation(runInsert, { constraint: "orders_order_code_key" });
  } catch (err) {
    // Concurrent idempotent replay: two retries of the same offline order raced
    // past the up-front SELECT; one committed first and this one hit the
    // client_uuid unique index. Return the winner instead of a 500.
    if (input.clientUuid && isUniqueViolation(err, "orders_client_uuid_unique")) {
      const existing = await existingOrderByClientUuid(sql, input.clientUuid);
      if (existing) return existing;
    }
    throw err;
  }
  const [order] = results[0];

  // New order has no invoices/deliveries/returns yet → 'ordered'. Recompute so
  // the stored ladder is set from the same ground truth as everywhere else.
  await recomputeOrderFulfillment(sql, str(order.id));

  return {
    ...mapOrderRow({ ...order, customerName: null }),
    items: [...enrichedItems],
    existing: false,
  };
}

export interface UpdateOrderInput {
  customerId: string;
  salesExecutiveId?: string | null;
  orderDate?: string | null;
  items: OrderItemInput[];
}

type FulfillmentStage = "ordered" | "invoiced" | "delivered" | "partially_delivered";

/** Where an order sits on the fulfillment ladder, from its invoice/delivery aggregates. */
function fulfillmentStage(
  invoiceCount: number,
  deliveredCount: number,
  invOil: number,
  ordOil: number,
): FulfillmentStage {
  if (invoiceCount === 0) return "ordered";
  if (deliveredCount === 0) return "invoiced";
  if (deliveredCount >= invoiceCount && invOil >= ordOil - 0.01) return "delivered";
  return "partially_delivered";
}

/**
 * Full order edit (SUPER_ADMIN / MANAGER): replace the header + all line items.
 * Blocked once the order has been invoiced. Header update, item wipe, and the
 * new item inserts run in one transaction so the order is never left partial.
 */
export async function updateOrder(
  sql: SqlClient,
  context: OrderContext,
  orderId: string,
  input: UpdateOrderInput,
) {
  if (!input.items || input.items.length === 0) {
    throw new ApiError("INVALID_FIELD", "Order must have at least one item.", 422);
  }
  if (!input.customerId) {
    throw new ApiError("INVALID_FIELD", "customerId is required.", 422);
  }

  // Fulfillment stage decides what can be edited. Invoices link via
  // invoices.order_id (partial delivery); their per-SKU allocations reference
  // this order's line items, so wiping lines is only safe before anything is
  // billed.
  const [agg] = await sql`
    /* order_fulfillment_for_update */
    select
      coalesce(f.invoice_count, 0)::int as "invoiceCount",
      coalesce(f.delivered_count, 0)::int as "deliveredCount",
      coalesce(f.inv_oil, 0)::numeric as "invOil",
      coalesce(t.ord_oil, 0)::numeric as "ordOil"
    from orders o
    left join lateral (
      select
        count(iv.id)::int as invoice_count,
        count(iv.id) filter (where ds.id is not null)::int as delivered_count,
        coalesce(sum(iv.total_litres), 0)::numeric as inv_oil
      from invoices iv
      left join delivery_run_stops ds on ds.invoice_id = iv.id
      where iv.order_id = o.id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
    ) f on true
    left join lateral (
      select
        coalesce(sum(oi.total_litres) filter (where oi.product_id is not null), 0)::numeric as ord_oil
      from order_items oi where oi.order_id = o.id
    ) t on true
    where o.id = ${orderId}::uuid
  `;
  if (!agg) throw new ApiError("NOT_FOUND", "Order not found.", 404);

  const invoiceCount = Number(agg.invoiceCount);
  const deliveredCount = Number(agg.deliveredCount);
  const invOil = Number(agg.invOil);
  const ordOil = Number(agg.ordOil);
  const stage = fulfillmentStage(invoiceCount, deliveredCount, invOil, ordOil);

  // Invoiced-not-delivered and fully-delivered are locked (mirrors the UI:
  // Invoiced → Cancel only, Delivered → no actions).
  if (stage === "invoiced" || stage === "delivered") {
    throw new ApiError(
      "CONFLICT",
      stage === "delivered"
        ? "This order is fully delivered and can no longer be edited."
        : "This order has been invoiced and can no longer be edited.",
      409,
    );
  }

  // ── Ordered: nothing billed yet → full replace of header + all line items. ──
  if (stage === "ordered") {
    const { enrichedItems, totalLitres } = await prepareOrderItems(sql, input.items);
    await sql.transaction([
      sql`
        /* update_order_header */
        update orders set
          customer_id = ${input.customerId},
          sales_executive_id = ${input.salesExecutiveId ?? null},
          order_date = coalesce(${input.orderDate ?? null}::date, order_date),
          total_litres = ${totalLitres},
          updated_at = now()
        where id = ${orderId}::uuid
      `,
      sql`/* clear_order_items */ delete from order_items where order_id = ${orderId}::uuid`,
      ...enrichedItems.map(
        (item) => sql`
          /* update_order_oil_item */
          insert into order_items (order_id, product_id, brand, quantity_units, pack_size_litres, total_litres, segment)
          values (${orderId}, ${item.productId}, ${item.brand}, ${item.quantityUnits}, ${item.packSizeLitres}, ${item.totalLitres}, ${item.segment})
        `,
      ),
    ]);
    return getOrderById(sql, context, orderId);
  }

  // ── Partially delivered: edit ONLY the un-invoiced remainder. ──
  // Existing lines + how much of each is already billed (allocations).
  const existingRows = await sql`
    /* order_items_for_partial_update */
    select
      oi.id,
      (oi.product_id is not null) as "isOil",
      oi.pack_size_litres as "packSizeLitres",
      oi.quantity_units as "orderedUnits",
      coalesce(al.alloc, 0)::numeric as "invoicedUnits",
      coalesce(dl.delivered, 0)::numeric as "deliveredUnits"
    from order_items oi
    left join (
      select a.order_item_id, sum(a.quantity_units) as alloc
      from invoice_line_allocations a
      join invoices iv on iv.id = a.invoice_id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
      group by a.order_item_id
    ) al on al.order_item_id = oi.id
    left join (
      select a.order_item_id, sum(a.quantity_units) as delivered
      from invoice_line_allocations a
      join invoices iv on iv.id = a.invoice_id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
      join delivery_run_stops ds on ds.invoice_id = iv.id
      group by a.order_item_id
    ) dl on dl.order_item_id = oi.id
    where oi.order_id = ${orderId}::uuid
  `;
  const existingById = new Map(
    existingRows.map((r) => [
      str(r.id),
      {
        isOil: r.isOil === true,
        pack: r.packSizeLitres == null ? 0 : Number(r.packSizeLitres),
        ordered: Number(r.orderedUnits) || 0,
        invoiced: Number(r.invoicedUnits) || 0,
        delivered: Number(r.deliveredUnits) || 0,
      },
    ]),
  );
  const allocatedIds = existingRows
    .filter((r) => Number(r.invoicedUnits) > 0)
    .map((r) => str(r.id));

  const lockedItems = input.items.filter((i) => i.orderItemId);
  const freshItems = input.items.filter((i) => !i.orderItemId);

  for (const li of lockedItems) {
    const ex = existingById.get(li.orderItemId as string);
    if (!ex) throw new ApiError("INVALID_FIELD", "Unknown order line.", 422);
    // The committed (invoiced/delivered) units are immutable; only the un-invoiced
    // REMAINDER can be raised or lowered. A line can therefore never drop below its
    // invoiced quantity — which also protects the delivered units (delivered ≤
    // invoiced) — so even a misbehaving client can't under-bill or un-ship goods.
    if (li.quantityUnits < ex.invoiced) {
      throw new ApiError(
        "INVALID_FIELD",
        `A billed line can't be reduced below its invoiced quantity (${ex.invoiced}).`,
        422,
      );
    }
  }

  const fresh = await prepareOrderItems(sql, freshItems);

  const statements = [
    // 1. Update each locked line's quantity in place (product/pack unchanged).
    ...lockedItems.map((li) => {
      const ex = existingById.get(li.orderItemId as string)!;
      // Litres line → recompute total; quantity-unit product (pack null/0) →
      // total stays null (constraint forbids a lone total).
      const totalLitres = ex.isOil && ex.pack > 0 ? li.quantityUnits * ex.pack : null;
      return sql`
        /* partial_update_locked_line */
        update order_items
        set quantity_units = ${li.quantityUnits}, total_litres = ${totalLitres}
        where id = ${li.orderItemId}::uuid and order_id = ${orderId}::uuid
      `;
    }),
    // 2. Remove only the un-invoiced existing lines — BEFORE inserting the fresh
    //    ones so the new rows aren't caught by the delete.
    allocatedIds.length > 0
      ? sql`delete from order_items where order_id = ${orderId}::uuid and id <> all(${allocatedIds}::uuid[])`
      : sql`delete from order_items where order_id = ${orderId}::uuid`,
    // 3. Insert the fresh (un-invoiced) lines.
    ...fresh.enrichedItems.map(
      (item) => sql`
        insert into order_items (order_id, product_id, brand, quantity_units, pack_size_litres, total_litres, segment)
        values (${orderId}, ${item.productId}, ${item.brand}, ${item.quantityUnits}, ${item.packSizeLitres}, ${item.totalLitres}, ${item.segment})
      `,
    ),
    // 4. Header — SE + date only (customer is fixed once invoiced).
    sql`
      update orders set
        sales_executive_id = ${input.salesExecutiveId ?? null},
        order_date = coalesce(${input.orderDate ?? null}::date, order_date),
        updated_at = now()
      where id = ${orderId}::uuid
    `,
    // 5. Recompute the order's total litres from the resulting lines.
    sql`
      update orders set total_litres = (
        select coalesce(sum(total_litres), 0) from order_items where order_id = ${orderId}::uuid
      ) where id = ${orderId}::uuid
    `,
  ];

  await sql.transaction(statements);
  // Line changes can move the per-SKU "fully invoiced" flag → refresh the ladder.
  await recomputeOrderFulfillment(sql, orderId);
  return getOrderById(sql, context, orderId);
}

/**
 * Soft delete (SUPER_ADMIN / MANAGER): mark an order Cancelled. Blocked once
 * the order has been invoiced.
 */
export async function cancelOrder(
  sql: SqlClient,
  _context: OrderContext,
  orderId: string,
  note?: string | null,
) {
  const [existing] = await sql`
    /* get_order_for_cancel */
    select id, order_code as "orderCode", order_status as "orderStatus"
    from orders where id = ${orderId}::uuid
  `;
  if (!existing) throw new ApiError("NOT_FOUND", "Order not found.", 404);
  if (existing.orderStatus === "cancelled") {
    throw new ApiError("CONFLICT", "This order is already cancelled.", 409);
  }

  // How much of the order has been billed vs still un-invoiced. Invoiced =
  // non-rejected invoice_line_allocations per billable line; remainder = the
  // ordered quantity minus that. This drives the three cancel behaviours below.
  const [totals] = await sql`
    /* order_cancel_totals */
    select
      coalesce(sum(coalesce(al.alloc, 0)), 0)::numeric as "invoicedUnits",
      coalesce(sum(greatest(oi.quantity_units - coalesce(al.alloc, 0), 0)), 0)::numeric as "remainingUnits"
    from order_items oi
    left join (
      select a.order_item_id, sum(a.quantity_units) as alloc
      from invoice_line_allocations a
      join invoices iv on iv.id = a.invoice_id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
      group by a.order_item_id
    ) al on al.order_item_id = oi.id
    where oi.order_id = ${orderId}::uuid
      and oi.product_id is not null
  `;
  const invoicedUnits = num(totals?.invoicedUnits);
  const remainingUnits = num(totals?.remainingUnits);

  // Fully invoiced (nothing left un-billed) → nothing to cancel. Block it: this
  // used to silently void a fully-invoiced order, which was the foot-gun.
  if (invoicedUnits > 0.001 && remainingUnits <= 0.001) {
    throw new ApiError(
      "CONFLICT",
      "This order is fully invoiced — there's nothing left to cancel.",
      409,
    );
  }

  // Optional free-text reason; trim to null so a blank/whitespace entry doesn't
  // store an empty string.
  const cancellationNote = note && note.trim() !== "" ? note.trim() : null;

  // Nothing invoiced yet → full void (unchanged behaviour): mark the whole order
  // cancelled. The ladder recomputes to 'cancelled'.
  if (invoicedUnits <= 0.001) {
    await sql`
      /* cancel_order */
      update orders
      set order_status = 'cancelled', cancellation_note = ${cancellationNote}, updated_at = now()
      where id = ${orderId}::uuid
    `;
    await recomputeOrderFulfillment(sql, orderId); // → 'cancelled'
    return { id: orderId, orderCode: str(existing.orderCode), cancellationNote, mode: "cancelled" as const };
  }

  // Partially invoiced → SHORT-CLOSE the un-invoiced remainder: shrink each line
  // down to its invoiced quantity, record the cancelled remainder per line, and
  // recompute the header litres. No stock/dues effects — the remainder was never
  // billed or dispatched. The ladder recomputes to 'partially_cancelled'.
  await sql.transaction([
    // 1. Per line with a remainder: bank the cancelled qty and shrink to invoiced.
    //    total_litres/estimated_line_value follow the (reduced) quantity.
    sql`
      /* short_close_lines */
      update order_items oi
      set
        cancelled_units = greatest(oi.quantity_units - coalesce(al.alloc, 0), 0),
        quantity_units = coalesce(al.alloc, 0),
        total_litres = case
          when oi.product_id is not null then coalesce(al.alloc, 0) * oi.pack_size_litres
          else oi.total_litres
        end,
        estimated_line_value = case
          when oi.estimated_unit_price is not null then coalesce(al.alloc, 0) * oi.estimated_unit_price
          else oi.estimated_line_value
        end
      from order_items base
      left join (
        select a.order_item_id, sum(a.quantity_units) as alloc
        from invoice_line_allocations a
        join invoices iv on iv.id = a.invoice_id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
        group by a.order_item_id
      ) al on al.order_item_id = base.id
      where oi.id = base.id
        and base.order_id = ${orderId}::uuid
        and base.product_id is not null
        and base.quantity_units - coalesce(al.alloc, 0) > 0.001
    `,
    // 2. Header: recompute total litres from the shrunk lines + store the note.
    sql`
      /* short_close_header */
      update orders set
        total_litres = (select coalesce(sum(total_litres), 0) from order_items where order_id = ${orderId}::uuid),
        cancellation_note = ${cancellationNote},
        updated_at = now()
      where id = ${orderId}::uuid
    `,
  ]);
  await recomputeOrderFulfillment(sql, orderId); // → 'partially_cancelled'
  return { id: orderId, orderCode: str(existing.orderCode), cancellationNote, mode: "short_closed" as const };
}
