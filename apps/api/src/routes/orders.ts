import { Hono } from "hono";
import { waitUntilSafe } from "../lib/wait-until";
import { success } from "../lib/api-response";
import { requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { assertUuidParam } from "../lib/validate";
import {
  optionalString,
  readJsonObject,
} from "../lib/request-body";
import {
  cancelOrder,
  createOrder,
  getOrderById,
  listOrderInvoiceableItems,
  listOrders,
  listOrdersPaged,
  listProducts,
  listRecentOrdersByCustomerBulk,
  listSalesExecutives,
  orderFulfillmentSummary,
  updateOrder,
} from "../services/orders";
import { assertCustomerVisible } from "../services/customers";
import { isFutureOrderDate } from "../services/order-date";
import { executiveFirstName, notifyOfficeWebPush, vapidFromEnv } from "../services/web-push-notify";
import { notifyAdmins } from "../services/admin-notify";
import { orderBody } from "../services/notify-format";
import { ApiError } from "../lib/errors";
import type { ApiEnv } from "../types";

export const ordersRoutes = new Hono<ApiEnv>()
  .get("/products", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"]);
    const { since } = c.req.query();
    const products = await listProducts(
      getSqlClient(c),
      { userId: auth.userId! },
      { since: since ?? null },
    );
    return c.json(success(c, { products }));
  })
  .get("/recent-bulk", async (c) => {
    // SALES_EXECUTIVE offline prefetch: last-5 orders for ALL their customers in
    // ONE windowed query (replaces the per-customer N+1). Scoped to the SE's own
    // customers inside the service. Static path is matched ahead of "/:id".
    const auth = requireRole(c, ["SALES_EXECUTIVE"]);
    const since = c.req.query("since") ?? null;
    const result = await listRecentOrdersByCustomerBulk(
      getSqlClient(c),
      { userId: auth.userId! },
      5,
      since,
    );
    return c.json(success(c, result));
  })
  .get("/sales-executives", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const salesExecutives = await listSalesExecutives(getSqlClient(c), {
      userId: auth.userId!,
    });
    return c.json(success(c, { salesExecutives }));
  })
  .get("/", async (c) => {
    // SALES_EXECUTIVE: customer order history in the mobile app — must be
    // scoped to one of THEIR customers (decided 2026-07-10).
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"]);
    const { status, customerId, salesExecutiveId, dateFrom, dateTo, search } = c.req.query();
    if (auth.role === "SALES_EXECUTIVE") {
      if (!customerId) {
        throw new ApiError("INVALID_FIELD", "customerId is required.", 422);
      }
      await assertCustomerVisible(
        getSqlClient(c),
        { userId: auth.userId!, role: auth.role },
        customerId,
      );
    }
    const orders = await listOrders(
      getSqlClient(c),
      { userId: auth.userId! },
      {
        status: status ?? null,
        customerId: customerId ?? null,
        salesExecutiveId: salesExecutiveId ?? null,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        search: search ?? null,
      },
    );
    return c.json(success(c, { orders }));
  })
  // Paginated/sorted/filtered list for the web table (standard table stack).
  // Registered before /:id so "paged" is not treated as an order id. Office roles.
  .get("/paged", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const q = c.req.query();
    const num = (v: string | undefined) => (v == null || v === "" ? null : Number(v));
    const result = await listOrdersPaged(
      getSqlClient(c),
      { userId: auth.userId! },
      {
        status: q.status ?? null,
        customerId: q.customerId ?? null,
        city: q.city ?? null,
        salesExecutiveId: q.salesExecutiveId ?? null,
        dateFrom: q.dateFrom ?? null,
        dateTo: q.dateTo ?? null,
        search: q.search ?? null,
        fulfillment: q.fulfillment ?? null,
        sort: q.sort ?? null,
        dir: q.dir ?? null,
        page: num(q.page),
        pageSize: num(q.pageSize),
      },
    );
    return c.json(
      success(c, { orders: result.rows, total: result.total, page: result.page, pageSize: result.pageSize }),
    );
  })
  // Fulfillment funnel for the Orders page (office roles). Before /:id.
  .get("/fulfillment-summary", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const summary = await orderFulfillmentSummary(getSqlClient(c));
    return c.json(success(c, { summary }));
  })
  .get("/:id", async (c) => {
    // SALES_EXECUTIVE: order detail sheet in the mobile app — the order must
    // belong to one of THEIR customers (same scoping as the list above).
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"]);
    const order = await getOrderById(
      getSqlClient(c),
      { userId: auth.userId! },
      assertUuidParam(c.req.param("id"), "Order"),
    );
    if (auth.role === "SALES_EXECUTIVE") {
      await assertCustomerVisible(
        getSqlClient(c),
        { userId: auth.userId!, role: auth.role },
        order.customerId,
      );
    }
    return c.json(success(c, { order }));
  })
  .get("/:id/invoiceable", async (c) => {
    // Per-SKU ordered/invoiced/remaining for the Create-Invoice form.
    // `?excludeInvoiceId=` drops that invoice's own allocations from the invoiced
    // total so editing a generated invoice sees the remaining as if its lines weren't billed yet.
    const auth = requireRole(c, ["SUPER_ADMIN", "ACCOUNTANT"]);
    const excludeInvoiceId = c.req.query("excludeInvoiceId") || undefined;
    const data = await listOrderInvoiceableItems(
      getSqlClient(c),
      { userId: auth.userId! },
      assertUuidParam(c.req.param("id"), "Order"),
      { excludeInvoiceId },
    );
    return c.json(success(c, data));
  })
  .post("/", async (c) => {
    const auth = await requireCapability(c, "action:orders.create", [
      "SUPER_ADMIN",
      "MANAGER",
      "ACCOUNTANT",
      "SALES_EXECUTIVE",
    ]);
    const body = await readJsonObject(c);

    const rawItems = body.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return c.json(
        { success: false, error: { code: "INVALID_FIELD", message: "Order must have at least one item." } },
        422,
      );
    }

    const customerId = optionalString(body, "customerId");
    if (!customerId) {
      return c.json(
        { success: false, error: { code: "INVALID_FIELD", message: "customerId is required." } },
        422,
      );
    }

    // Each item is an oil (productId) — the service validates the quantity rules.
    const items = rawItems.map((item: Record<string, unknown>) => ({
      productId: optionalString(item, "productId"),
      quantityUnits: Number(item.quantityUnits),
      packSizeLitres: item.packSizeLitres == null ? null : Number(item.packSizeLitres),
      segment: optionalString(item, "segment"),
      // Partial-edit: identifies an existing (billed) line to update in place.
      orderItemId: optionalString(item, "orderItemId"),
    }));

    if (auth.role === "SALES_EXECUTIVE") {
      await assertCustomerVisible(
        getSqlClient(c),
        { userId: auth.userId!, role: auth.role },
        customerId,
      );
    }

    // A sales executive always creates orders for themselves.
    const salesExecutiveId =
      auth.role === "SALES_EXECUTIVE"
        ? auth.userId!
        : optionalString(body, "salesExecutiveId");

    // Office/web users may back-date an order but never future-date it (IST). The
    // mobile field-salesperson flow (SALES_EXECUTIVE) is exempt.
    const orderDate = optionalString(body, "orderDate");
    if (auth.role !== "SALES_EXECUTIVE" && isFutureOrderDate(orderDate)) {
      return c.json(
        { success: false, error: { code: "INVALID_FIELD", message: "Order date cannot be in the future." } },
        422,
      );
    }

    const sql = getSqlClient(c);
    const order = await createOrder(
      sql,
      { userId: auth.userId! },
      {
        customerId,
        salesExecutiveId,
        orderDate,
        clientUuid: optionalString(body, "clientUuid"),
        items,
      },
    );

    if (!order.existing) {
      await logAudit(sql, actorOf(auth), {
        action: "order.create",
        entityType: "order",
        entityId: order.id,
        entityLabel: order.orderCode,
        summary: order.customerName
          ? `Created order ${order.orderCode} for ${order.customerName}`
          : `Created order ${order.orderCode}`,
      });

      // Notifications fire ONLY for field (SALES_EXECUTIVE) creations. When an
      // office role (SUPER_ADMIN / MANAGER / ACCOUNTANT) creates an order it is
      // data entry — don't alert office users (web) or Super Admins (mobile)
      // about something they entered themselves.
      if (auth.role === "SALES_EXECUTIVE") {
        // Context-aware notifications naming the executive ("Sandeep · ORD-123 ·
        // Ravi Motors"): office Web Push (reaches a closed tab) + Super-Admin
        // FCM/Alerts feed. SE first name fetched once, one shared body.
        const vapid = vapidFromEnv(c.env);
        waitUntilSafe(c, 
          (async () => {
            const se = await executiveFirstName(sql, auth.userId);
            const body = orderBody(se, order.orderCode, order.customerName ?? null);
            if (vapid) {
              await notifyOfficeWebPush(
                sql,
                vapid,
                { title: "New order", body, tag: "sri-aparajita-order", url: "/orders" },
                Math.floor(Date.now() / 1000),
              );
            }
            await notifyAdmins(sql, { type: "admin_order", title: "New order", body, customerId });
          })(),
        );
      }
    }

    return c.json(success(c, { order }), order.existing ? 200 : 201);
  })
  // Full edit (SUPER_ADMIN / MANAGER): replace header + line items.
  .patch("/:id", async (c) => {
    // ACCOUNTANT can edit the un-invoiced remainder of a partially-delivered
    // order (the service enforces exactly what each stage allows).
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const body = await readJsonObject(c);

    const rawItems = body.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return c.json(
        { success: false, error: { code: "INVALID_FIELD", message: "Order must have at least one item." } },
        422,
      );
    }
    const customerId = optionalString(body, "customerId");
    if (!customerId) {
      return c.json(
        { success: false, error: { code: "INVALID_FIELD", message: "customerId is required." } },
        422,
      );
    }
    const items = rawItems.map((item: Record<string, unknown>) => ({
      productId: optionalString(item, "productId"),
      quantityUnits: Number(item.quantityUnits),
      packSizeLitres: item.packSizeLitres == null ? null : Number(item.packSizeLitres),
      segment: optionalString(item, "segment"),
      // Partial-edit: identifies an existing (billed) line to update in place.
      orderItemId: optionalString(item, "orderItemId"),
    }));

    // Editing is office/web-only (role-gated above) — never future-date an order.
    const orderDate = optionalString(body, "orderDate");
    if (isFutureOrderDate(orderDate)) {
      return c.json(
        { success: false, error: { code: "INVALID_FIELD", message: "Order date cannot be in the future." } },
        422,
      );
    }

    const sql = getSqlClient(c);
    const order = await updateOrder(sql, { userId: auth.userId! }, assertUuidParam(c.req.param("id"), "Order"), {
      customerId,
      salesExecutiveId: optionalString(body, "salesExecutiveId"),
      orderDate,
      items,
    });
    await logAudit(sql, actorOf(auth), {
      action: "order.update",
      entityType: "order",
      entityId: order.id,
      entityLabel: order.orderCode,
      summary: `Edited order ${order.orderCode}`,
    });
    return c.json(success(c, { order }));
  })
  // Soft delete (SUPER_ADMIN / MANAGER): mark the order Cancelled.
  .post("/:id/cancel", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const sql = getSqlClient(c);
    // Body is optional — only the web cancel dialog sends { note }.
    const body = await readJsonObject(c).catch(() => ({}));
    const note = optionalString(body, "note");
    const cancelled = await cancelOrder(sql, { userId: auth.userId! }, assertUuidParam(c.req.param("id"), "Order"), note);
    await logAudit(sql, actorOf(auth), {
      action: "order.cancel",
      entityType: "order",
      entityId: cancelled.id,
      entityLabel: cancelled.orderCode,
      summary: cancelled.cancellationNote
        ? `Cancelled order ${cancelled.orderCode} — ${cancelled.cancellationNote}`
        : `Cancelled order ${cancelled.orderCode}`,
      metadata: cancelled.cancellationNote ? { note: cancelled.cancellationNote } : null,
    });
    return c.json(success(c, { ok: true }));
  });
