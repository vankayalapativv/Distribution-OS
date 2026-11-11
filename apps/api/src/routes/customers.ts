import { Hono } from "hono";
import { waitUntilSafe } from "../lib/wait-until";
import { success } from "../lib/api-response";
import { ApiError } from "../lib/errors";
import { ensureStatementToken } from "../services/customer-statement";
import { requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import {
  optionalNumber,
  optionalString,
  readJsonObject,
  requiredString,
} from "../lib/request-body";
import {
  assertCustomerVisible,
  createCustomer,
  getCustomerById,
  getCustomerLedger,
  getCustomerLedgersBulk,
  listCustomers,
  listCustomersPaged,
  listCustomerFilterOptions,
  listCustomerInvoices,
  updateCustomer,
  updateCustomerSeFields,
  updateCustomerStatus,
} from "../services/customers";
import { getCustomerVisits } from "../services/customer-visits";
import {
  getReassignPreview,
  reassignCustomer,
  undoReassignment,
} from "../services/customer-reassign";
import { enrollCustomerInTodayBeat } from "../services/beat-assign";
import { notifyAdmins } from "../services/admin-notify";
import {
  clearOpeningBalance,
  getOpeningBalance,
  upsertOpeningBalance,
  type OpeningBalanceRole,
} from "../services/opening-balance";
import { reReconcileCustomer } from "../services/collections";
import type { ApiEnv } from "../types";

export const customersRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    // LOGISTICS (delivery app) needs the full customer list to pick a stop.
    const auth = requireRole(c, [
      "SUPER_ADMIN",
      "MANAGER",
      "ACCOUNTANT",
      "SALES_EXECUTIVE",
      "LOGISTICS",
    ]);
    const { status, customerGrade, search, since } = c.req.query();

    const customers = await listCustomers(
      getSqlClient(c),
      { userId: auth.userId!, role: auth.role },
      {
        status: status ?? null,
        customerGrade: customerGrade ?? null,
        search: search ?? null,
        since: since ?? null,
      },
    );

    return c.json(success(c, customers));
  })
  // Paginated/sorted/filtered list for the web table (standard table stack).
  // Registered before /:id so "paged" is not treated as a customer id.
  .get("/paged", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"]);
    const q = c.req.query();
    const num = (v: string | undefined) => (v == null || v === "" ? null : Number(v));
    const result = await listCustomersPaged(
      getSqlClient(c),
      { userId: auth.userId!, role: auth.role },
      {
        status: q.status ?? null,
        search: q.search ?? null,
        city: q.city ?? null,
        salesExecutiveId: q.salesExecutiveId ?? null,
        dues: q.dues ?? null,
        sort: q.sort ?? null,
        dir: q.dir ?? null,
        page: num(q.page),
        pageSize: num(q.pageSize),
      },
    );
    return c.json(
      success(c, { customers: result.rows, total: result.total, page: result.page, pageSize: result.pageSize }),
    );
  })
  // City + sales-executive options for the customer-list filter dropdowns.
  // Registered before /:id so "filter-options" is not treated as a customer id.
  .get("/filter-options", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const executiveId = c.req.query("executiveId") || null;
    const options = await listCustomerFilterOptions(getSqlClient(c), executiveId);
    return c.json(success(c, options));
  })
  .get("/:id/invoices", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"]);

    const result = await listCustomerInvoices(
      getSqlClient(c),
      { userId: auth.userId!, role: auth.role },
      c.req.param("id"),
    );

    return c.json(success(c, result));
  })
  // ── Opening balance (per-customer pre-system carry-forward debt) ──────────────
  // View: office roles. Manage: ACCOUNTANT (create once) + SUPER_ADMIN (full).
  .get("/:id/opening-balance", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const sql = getSqlClient(c);
    await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, c.req.param("id"));
    const openingBalance = await getOpeningBalance(sql, c.req.param("id"));
    return c.json(success(c, { openingBalance }));
  })
  .put("/:id/opening-balance", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "ACCOUNTANT"]);
    const sql = getSqlClient(c);
    const customerId = c.req.param("id");
    await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, customerId);
    const body = await readJsonObject(c);
    const ctx = { userId: auth.userId!, role: auth.role as OpeningBalanceRole };
    const saved = await upsertOpeningBalance(
      sql,
      ctx,
      customerId,
      {
        asOfDate: requiredString(body, "asOfDate"),
        openingAmount: optionalNumber(body, "openingAmount") ?? 0,
        remarks: optionalString(body, "remarks"),
      },
      () => reReconcileCustomer(sql, { userId: auth.userId! }, customerId),
    );
    await logAudit(sql, actorOf(auth), {
      action: "opening_balance.upsert",
      entityType: "customer",
      entityId: customerId,
      entityLabel: saved.openingAmount.toString(),
      summary: `Set opening balance ₹${saved.openingAmount} (as of ${saved.asOfDate})`,
    });
    return c.json(success(c, { openingBalance: saved }));
  })
  .delete("/:id/opening-balance", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const sql = getSqlClient(c);
    const customerId = c.req.param("id");
    await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, customerId);
    await clearOpeningBalance(
      sql,
      { userId: auth.userId!, role: auth.role as OpeningBalanceRole },
      customerId,
      () => reReconcileCustomer(sql, { userId: auth.userId! }, customerId),
    );
    await logAudit(sql, actorOf(auth), {
      action: "opening_balance.clear",
      entityType: "customer",
      entityId: customerId,
      summary: "Cleared opening balance",
    });
    return c.json(success(c, { ok: true }));
  })
  // Bulk: full (all-time) ledgers for every customer visible to the caller — the
  // mobile app's offline prefetch. Static "/ledgers/bulk" is matched ahead of the
  // "/:id/…" params. The app slices each full statement to the chosen range on-device.
  .get("/ledgers/bulk", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"]);
    const sql = getSqlClient(c);
    // ?since=<serverTime cursor> → only customers whose ledger changed since then.
    const since = c.req.query("since") ?? null;
    const result = await getCustomerLedgersBulk(
      sql,
      { userId: auth.userId!, role: auth.role },
      since,
    );
    return c.json(success(c, result));
  })
  .get("/:id/ledger", async (c) => {
    // Combined invoice + collection running statement. Managers may view it —
    // it's the one place they see invoice amounts (agreed with the client).
    // SALES_EXECUTIVE (2026-07-31): the mobile ledger screen — scoped to their
    // own customers via assertCustomerVisible below (foreign customers 404).
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"]);
    const sql = getSqlClient(c);
    await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, c.req.param("id"));
    const ledger = await getCustomerLedger(
      sql,
      c.req.param("id"),
      c.req.query("from") ?? null,
      c.req.query("to") ?? null,
    );
    return c.json(success(c, ledger));
  })
  .post("/:id/statement-token", async (c) => {
    // Office staff press "Copy ledger link": mint-once (idempotent) and return
    // the customer's permanent public-statement token. All three back-office
    // roles may share; never SALES_EXECUTIVE. Scoped via assertCustomerVisible.
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const sql = getSqlClient(c);
    await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, c.req.param("id"));
    const token = await ensureStatementToken(sql, c.req.param("id"));
    if (!token) throw new ApiError("NOT_FOUND", "Customer not found.", 404);
    return c.json(success(c, { token }));
  })
  // Check-in / visit history for the web customer page's Visits tab (office roles).
  .get("/:id/visits", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const q = c.req.query();
    const num = (v?: string) => (v == null || v === "" ? null : Number(v));
    const result = await getCustomerVisits(
      getSqlClient(c),
      c.req.param("id"),
      q.from ?? null,
      q.to ?? null,
      num(q.page) ?? 1,
      num(q.pageSize) ?? 8,
    );
    return c.json(success(c, result));
  })
  // ── Customer reassignment (SUPER_ADMIN moves ownership between SEs) ───────────
  // Per-customer only — there is no bulk endpoint. Preview shows the current
  // owner + what would move; reassign applies it atomically; undo reverses the
  // latest reassignment (only the exact rows it moved).
  .get("/:id/reassign/preview", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    const preview = await getReassignPreview(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, preview));
  })
  .post("/:id/reassign", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const sql = getSqlClient(c);
    const customerId = c.req.param("id");
    const body = await readJsonObject(c);
    const toUserId = requiredString(body, "toUserId");
    const entry = await reassignCustomer(sql, { userId: auth.userId! }, customerId, toUserId);
    await logAudit(sql, actorOf(auth), {
      action: "customer.reassign",
      entityType: "customer",
      entityId: customerId,
      entityLabel: entry.toUserName ?? toUserId,
      summary: `Reassigned customer from ${entry.fromUserName ?? "—"} to ${entry.toUserName ?? "—"}`,
    });
    return c.json(success(c, entry));
  })
  .post("/:id/reassign/undo", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const sql = getSqlClient(c);
    const customerId = c.req.param("id");
    const entry = await undoReassignment(sql, { userId: auth.userId! }, customerId);
    await logAudit(sql, actorOf(auth), {
      action: "customer.reassign.undo",
      entityType: "customer",
      entityId: customerId,
      entityLabel: entry.fromUserName ?? "",
      summary: `Undid reassignment — customer returned to ${entry.fromUserName ?? "—"}`,
    });
    return c.json(success(c, entry));
  })
  .post("/", async (c) => {
    // SALES_EXECUTIVE: field capture from the mobile app (active immediately,
    // decided 2026-07-09).
    const auth = await requireCapability(c, "action:customers.edit", [
      "SUPER_ADMIN",
      "MANAGER",
      "ACCOUNTANT",
      "SALES_EXECUTIVE",
    ]);
    const body = await readJsonObject(c);

    // A SALES_EXECUTIVE (mobile) always owns the customers they create; an office
    // role (SUPER_ADMIN/MANAGER) must assign the new customer to a field executive.
    const salesExecutiveId =
      auth.role === "SALES_EXECUTIVE" ? auth.userId! : optionalString(body, "salesExecutiveId");

    const sql = getSqlClient(c);
    const customer = await createCustomer(
      sql,
      { userId: auth.userId! },
      {
        salesExecutiveId,
        legalName: requiredString(body, "legalName"),
        latitude: optionalNumber(body, "latitude"),
        longitude: optionalNumber(body, "longitude"),
        tradeName: optionalString(body, "tradeName"),
        customerName: optionalString(body, "customerName"),
        customerType: requiredString(body, "customerType"),
        segment: optionalString(body, "segment"),
        phone: optionalString(body, "phone"),
        alternativePhone: optionalString(body, "alternativePhone"),
        gstNumber: optionalString(body, "gstNumber"),
        panNumber: optionalString(body, "panNumber"),
        aadharNumber: optionalString(body, "aadharNumber"),
        addressStreet: optionalString(body, "addressStreet"),
        addressCity: optionalString(body, "addressCity"),
        addressState: optionalString(body, "addressState"),
        addressPincode: optionalString(body, "addressPincode"),
        addressLandmark: optionalString(body, "addressLandmark"),
        email: optionalString(body, "email"),
        customerGrade: optionalString(body, "customerGrade"),
        creditLimit: optionalNumber(body, "creditLimit"),
        creditDays: optionalNumber(body, "creditDays"),
        clientUuid: optionalString(body, "clientUuid"),
      },
    );

    // The owning SE's beat auto-picks up the new customer for today's weekday
    // (best-effort — never fail the create if enrollment hiccups). The owner is
    // the SE who created it (mobile) or the one an admin assigned it to (web).
    if (salesExecutiveId) {
      try {
        await enrollCustomerInTodayBeat(sql, salesExecutiveId, customer.id);
      } catch {
        // Non-fatal: the customer is still owned; the beat stop just isn't added.
      }
    }

    await logAudit(sql, actorOf(auth), {
      action: "customer.create",
      entityType: "customer",
      entityId: customer.id,
      entityLabel: customer.legalName,
      summary: `Created customer ${customer.legalName}`,
    });
    // FCM + Alerts feed to all Super Admins (mobile).
    waitUntilSafe(c, 
      notifyAdmins(sql, {
        type: "admin_customer",
        title: "New customer",
        body: customer.legalName,
        customerId: customer.id,
      }),
    );
    return c.json(success(c, customer), 201);
  })
  .get("/:id", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"]);

    const customer = await getCustomerById(
      getSqlClient(c),
      { userId: auth.userId!, role: auth.role },
      c.req.param("id"),
    );

    return c.json(success(c, customer));
  })
  .patch("/:id", async (c) => {
    const auth = await requireCapability(c, "action:customers.edit", [
      "SUPER_ADMIN",
      "MANAGER",
      "ACCOUNTANT",
      "SALES_EXECUTIVE",
    ]);
    const body = await readJsonObject(c);

    // SE edit is restricted (decided 2026-07-10; phone added 2026-07-15,
    // segment added 2026-07-17): address + GPS + phone + segment only, and
    // only on customers they created. Other fields in the body are ignored.
    const sql = getSqlClient(c);
    if (auth.role === "SALES_EXECUTIVE") {
      const customer = await updateCustomerSeFields(
        sql,
        { userId: auth.userId! },
        c.req.param("id"),
        {
          addressStreet: optionalString(body, "addressStreet"),
          addressCity: optionalString(body, "addressCity"),
          addressState: optionalString(body, "addressState"),
          addressPincode: optionalString(body, "addressPincode"),
          addressLandmark: optionalString(body, "addressLandmark"),
          phone: optionalString(body, "phone"),
          segment: optionalString(body, "segment"),
          latitude: optionalNumber(body, "latitude"),
          longitude: optionalNumber(body, "longitude"),
        },
      );
      await logAudit(sql, actorOf(auth), {
        action: "customer.update",
        entityType: "customer",
        entityId: customer.id,
        entityLabel: customer.legalName,
        summary: `Updated customer ${customer.legalName} (field details)`,
      });
      return c.json(success(c, customer));
    }

    const customer = await updateCustomer(
      sql,
      { userId: auth.userId! },
      c.req.param("id"),
      {
        legalName: optionalString(body, "legalName"),
        tradeName: optionalString(body, "tradeName"),
        customerName: optionalString(body, "customerName"),
        customerType: optionalString(body, "customerType"),
        segment: optionalString(body, "segment"),
        phone: optionalString(body, "phone"),
        alternativePhone: optionalString(body, "alternativePhone"),
        gstNumber: optionalString(body, "gstNumber"),
        panNumber: optionalString(body, "panNumber"),
        aadharNumber: optionalString(body, "aadharNumber"),
        addressStreet: optionalString(body, "addressStreet"),
        addressCity: optionalString(body, "addressCity"),
        addressState: optionalString(body, "addressState"),
        addressPincode: optionalString(body, "addressPincode"),
        addressLandmark: optionalString(body, "addressLandmark"),
        email: optionalString(body, "email"),
        customerGrade: optionalString(body, "customerGrade"),
        creditLimit: optionalNumber(body, "creditLimit"),
        creditDays: optionalNumber(body, "creditDays"),
      },
    );

    await logAudit(sql, actorOf(auth), {
      action: "customer.update",
      entityType: "customer",
      entityId: customer.id,
      entityLabel: customer.legalName,
      summary: `Updated customer ${customer.legalName}`,
    });
    return c.json(success(c, customer));
  })
  .patch("/:id/status", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const status = requiredString(body, "status");

    const customer = await updateCustomerStatus(
      sql,
      { userId: auth.userId! },
      c.req.param("id"),
      status,
    );

    await logAudit(sql, actorOf(auth), {
      action: "customer.status",
      entityType: "customer",
      entityId: customer.id,
      entityLabel: customer.legalName,
      summary: `Set customer ${customer.legalName} to ${status}`,
    });
    return c.json(success(c, customer));
  });
