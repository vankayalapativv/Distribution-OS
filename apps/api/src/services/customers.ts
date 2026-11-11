import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";
import { isUniqueViolation, retryOnUniqueViolation } from "../lib/pg-errors";
import { resolvePage, resolveSort } from "../lib/pagination";
import {
  type CustomerContext,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type ListCustomersFilters,
  type Row,
  VALID_STATUSES,
  VALID_CUSTOMER_TYPES,
  stringValue,
  nullableStringValue,
  numberValue,
  dateStringValue,
  mapCustomerRow,
  creatorScope,
} from "./customers-shared";

// The customers service is split (audit G-0104): shared foundation in
// ./customers-shared, ledger in ./customers-ledger. This module keeps the read +
// write paths and re-exports the rest so callers of ../services/customers are
// unchanged.
export * from "./customers-ledger";
export {
  assertCustomerVisible,
  type CustomerContext,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type ListCustomersFilters,
} from "./customers-shared";

export async function listCustomers(
  sql: SqlClient,
  context: CustomerContext,
  filters: ListCustomersFilters = {},
) {
  const rows = await sql`
    /* list_customers */
    select
      c.id,
      c.customer_code as "customerCode",
      c.legal_name as "legalName",
      c.trade_name as "tradeName",
      c.customer_name as "customerName",
      c.customer_type as "customerType",
      c.segment,
      c.phone,
      c.alternative_phone as "alternativePhone",
      c.gst_number as "gstNumber",
      c.pan_number as "panNumber",
      c.aadhar_number as "aadharNumber",
      c.address_street as "addressStreet",
      c.address_city as "addressCity",
      c.address_state as "addressState",
      c.address_pincode as "addressPincode",
      c.address_landmark as "addressLandmark",
      c.email,
      c.customer_grade as "customerGrade",
      c.credit_limit as "creditLimit",
      c.credit_days as "creditDays",
      c.payment_status as "paymentStatus",
      c.kyc_status as "kycStatus",
      c.approval_status as "approvalStatus",
      c.status,
      c.created_by as "createdBy",
      se.name as "salesExecutiveName",
      c.latitude,
      c.longitude
    from customers c
    left join users se on se.id = c.created_by
    where (${filters.status ?? null}::text is null or c.status = ${filters.status ?? null})
      and (${creatorScope(context)}::uuid is null or c.created_by = ${creatorScope(context)}::uuid)
      and (${filters.customerGrade ?? null}::text is null or c.customer_grade = ${filters.customerGrade ?? null})
      and (${filters.since ?? null}::text is null or c.updated_at > ${filters.since ?? null}::timestamptz)
      and (${filters.search ?? null}::text is null
           or c.legal_name ilike ${"%" + (filters.search ?? "") + "%"}
           or c.trade_name ilike ${"%" + (filters.search ?? "") + "%"}
           or c.phone ilike ${"%" + (filters.search ?? "") + "%"}
           or c.address_city ilike ${"%" + (filters.search ?? "") + "%"})
    order by c.created_at desc, c.legal_name
    -- This backs the mobile CONTACTS directory (full A–Z list + client-side
    -- search + offline cache), so it must return the caller's COMPLETE scoped
    -- set, not a page. SE is scoped to their own customers (small); office roles
    -- (SUPER_ADMIN/MANAGER/ACCOUNTANT) see every customer — a low cap silently
    -- dropped older ones from the list + search. Generous ceiling as a safety
    -- valve only (the paged/table endpoint below is the one that truly paginates).
    limit 5000
  `;

  return rows.map(mapCustomerRow);
}

export interface PagedCustomersParams {
  status?: string | null;
  search?: string | null;
  /** Filter: exact city (customers.address_city). */
  city?: string | null;
  /** Filter: the customer's sales executive (customers.created_by). */
  salesExecutiveId?: string | null;
  /** Filter: collection-dues state — "owes" | "credit" | "settled". */
  dues?: string | null;
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

const CUSTOMER_LIST_COLUMNS = `
  c.id,
  c.customer_code as "customerCode",
  c.legal_name as "legalName",
  c.trade_name as "tradeName",
  c.customer_name as "customerName",
  c.customer_type as "customerType",
  c.segment,
  c.phone,
  c.alternative_phone as "alternativePhone",
  c.gst_number as "gstNumber",
  c.pan_number as "panNumber",
  c.aadhar_number as "aadharNumber",
  c.address_street as "addressStreet",
  c.address_city as "addressCity",
  c.address_state as "addressState",
  c.address_pincode as "addressPincode",
  c.address_landmark as "addressLandmark",
  c.email,
  c.customer_grade as "customerGrade",
  c.credit_limit as "creditLimit",
  c.credit_days as "creditDays",
  c.payment_status as "paymentStatus",
  c.kyc_status as "kycStatus",
  c.approval_status as "approvalStatus",
  c.status,
  c.created_by as "createdBy"`;

const CUSTOMER_SORTS: Record<string, string> = {
  customerCode: "c.customer_code",
  legalName: "c.legal_name",
  customerType: "c.customer_type",
  status: "c.status",
  createdAt: "c.created_at",
  salesExecutive: "se.name",
  // Order by the computed output columns (defined in the SELECT below).
  collectionDues: `"collectionDues"`,
  oldestUnpaidDays: `"oldestUnpaidDays"`,
};

/**
 * Age (in days) of the customer's OLDEST invoice that still has an outstanding
 * balance — the "oldest unpaid" ageing. Null when nothing is outstanding.
 * Uses invoices.outstanding_amount (consistent with the dues column + buckets).
 */
const OLDEST_UNPAID_DAYS_EXPR = `
  (now() at time zone 'Asia/Kolkata')::date - (
    select min(d) from (
      select min(i.invoice_date) as d
      from invoices i
      where i.customer_id = c.id and i.outstanding_amount > 0
      union all
      select ob.as_of_date as d
      from customer_opening_balances ob
      where ob.customer_id = c.id and ob.outstanding_amount > 0
    ) x
  )`;

/**
 * Per-customer net balance owed — computed STATELESSLY from the ledger's own
 * inputs so it can never drift from the customer-detail "Total Debit Balance":
 *
 *   opening + Σ(non-rejected invoices) − Σ(non-rejected collections) − Σ(returns)
 *
 * This is the same math `assembleLedger` runs (collections include pending and
 * credit-notes — payment_mode='credit_note' rows live in `collections`). It
 * deliberately does NOT read `invoices.outstanding_amount`, which the old
 * incremental reconcile let drift. Correlated to `c.id`; positive = owes (Dr),
 * negative = credit (Cr), ~0 = settled.
 */
const COLLECTION_DUES_EXPR = `
  coalesce((
    select ob.opening_amount
    from customer_opening_balances ob
    where ob.customer_id = c.id
  ), 0)
  + coalesce((
    select sum(i.invoice_net_value)
    from invoices i
    where i.customer_id = c.id and i.approval_status <> 'rejected' and i.doc_status <> 'cancelled'
  ), 0)
  - coalesce((
    select sum(col.collection_amount)
    from collections col
    where col.customer_id = c.id and col.accountant_approval_status is distinct from 'rejected'
  ), 0)
  - coalesce((
    select sum(sr.gross_amount)
    from sales_returns sr
    where sr.customer_id = c.id
  ), 0)`;

/**
 * Server-side filtered/sorted/paginated customers for the web table (the
 * standard table stack — see apps/web/AGENTS.md). SE scoping still applies.
 * The plain `listCustomers` (array) stays for mobile sync + other consumers.
 */
export async function listCustomersPaged(
  sql: SqlClient,
  context: CustomerContext,
  opts: PagedCustomersParams,
) {
  const conds: string[] = [];
  const params: unknown[] = [];
  const status = (opts.status ?? "").trim();
  if (status) {
    params.push(status);
    conds.push(`c.status = $${params.length}`);
  }
  const scope = creatorScope(context);
  if (scope) {
    params.push(scope);
    conds.push(`c.created_by = $${params.length}::uuid`);
  }
  const search = (opts.search ?? "").trim();
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    conds.push(
      `(c.legal_name ilike ${p} or c.trade_name ilike ${p} or c.customer_code ilike ${p} or c.phone ilike ${p} or c.alternative_phone ilike ${p})`,
    );
  }
  const city = (opts.city ?? "").trim();
  if (city) {
    params.push(city);
    conds.push(`c.address_city = $${params.length}`);
  }
  const salesExecutiveId = (opts.salesExecutiveId ?? "").trim();
  if (salesExecutiveId) {
    params.push(salesExecutiveId);
    conds.push(`c.created_by = $${params.length}::uuid`);
  }
  const dues = (opts.dues ?? "").trim();
  if (dues === "owes") conds.push(`(${COLLECTION_DUES_EXPR}) > 0.005`);
  else if (dues === "credit") conds.push(`(${COLLECTION_DUES_EXPR}) < -0.005`);
  else if (dues === "settled") conds.push(`abs(${COLLECTION_DUES_EXPR}) <= 0.005`);

  const whereSql = conds.length ? `where ${conds.join(" and ")}` : "";

  const sort = resolveSort(opts.sort, opts.dir, CUSTOMER_SORTS, "createdAt");
  const { limit, offset, page, pageSize } = resolvePage(opts.page, opts.pageSize);

  // Count and page are independent — one parallel batch, not two sequential
  // ~50ms round-trips.
  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* list_customers_paged_count */
     select count(*)::int as total from customers c ${whereSql}`,
      params,
    ),
    sql.query(
      `/* list_customers_paged */
     select ${CUSTOMER_LIST_COLUMNS},
       se.name as "salesExecutiveName",
       (${COLLECTION_DUES_EXPR}) as "collectionDues",
       (exists (select 1 from invoices i where i.customer_id = c.id)
         or exists (select 1 from collections col where col.customer_id = c.id)) as "hasBusiness",
       (${OLDEST_UNPAID_DAYS_EXPR}) as "oldestUnpaidDays"
     from customers c
     left join users se
       on se.id = c.created_by
       and exists (
         select 1 from user_roles ur join roles r on r.id = ur.role_id
         where ur.user_id = se.id and r.code = 'SALES_EXECUTIVE'
       )
     ${whereSql}
     order by ${sort.expr} ${sort.dir} nulls last, c.legal_name asc
     limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);
  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return {
    rows: rows.map((r) => ({
      ...mapCustomerRow(r),
      salesExecutiveName: nullableStringValue(r.salesExecutiveName),
      collectionDues: numberValue(r.collectionDues),
      hasBusiness: r.hasBusiness === true,
      oldestUnpaidDays: r.oldestUnpaidDays == null ? null : numberValue(r.oldestUnpaidDays),
    })),
    total: numberValue(countRow?.total),
    page,
    pageSize,
  };
}

/** Distinct cities + active sales executives — feeds the customer-list filters. */
export async function listCustomerFilterOptions(
  sql: SqlClient,
  executiveId: string | null = null,
) {
  // Cities can be scoped to one executive's customers (dues card SE→city
  // dependency); the executive list is always the full active roster.
  const cityRows = (await sql`
    /* customer_cities */
    select distinct address_city as city
    from customers
    where address_city is not null and trim(address_city) <> ''
      and (${executiveId}::uuid is null or created_by = ${executiveId}::uuid)
    order by address_city
  `) as Row[];
  const seRows = (await sql`
    /* customer_sales_executives */
    select u.id, u.name
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    order by u.name
  `) as Row[];
  return {
    cities: cityRows.map((r) => stringValue(r.city)).filter((c) => c.length > 0),
    salesExecutives: seRows.map((r) => ({ id: stringValue(r.id), name: stringValue(r.name) })),
  };
}

export interface CustomerCreditStatus {
  /** Block ordering: owes money AND has debt overdue past THIS customer's own
   *  credit terms (no company-wide grace). */
  creditBlocked: boolean;
  /** This customer's own credit period in days (their `credit_days`). Field name
   *  kept for client/schema compatibility; it is now the per-customer term, not
   *  a company-wide threshold. */
  creditOverdueDays: number;
  /** Net ledger balance (positive = owes). */
  totalOutstanding: number;
}

/**
 * The credit gate for one customer, as a single source of truth shared by the
 * customer-detail header (so the blocked state is known at first paint) and the
 * invoices list (so the two can never disagree). Caller is responsible for the
 * visibility/existence check — this computes credit for the given id directly.
 */
export async function getCustomerCreditStatus(
  sql: SqlClient,
  customerId: string,
): Promise<CustomerCreditStatus> {
  // Overdue model (multi-enterprise): block right at each customer's OWN credit
  // terms — no company-wide grace. An invoice's due_date already encodes the
  // customer's credit_days (invoice_date + credit_days), so "past due_date" IS
  // "past their credit period". Openings (no due_date) age from as_of_date past
  // the customer's credit_days. We surface the customer's credit_days for display.
  const creditDaysRows = await sql`
    /* get_customer_credit_days */
    select coalesce(credit_days, 0) as "creditDays" from customers where id = ${customerId}::uuid
  `;
  const creditOverdueDays = numberValue((creditDaysRows as Row[])[0]?.creditDays);

  // Ledger balance + overdue check are independent of each other — run together.
  // Net balance = the STATELESS ledger balance (opening + non-rejected invoices
  // − non-rejected collections − returns), identical to the customer ledger's
  // closing balance, so the customer-page balance and the ledger can never
  // disagree. Positive = owes (Dr); negative = Cr.
  const [ledgerRows, overdueRows] = await Promise.all([
    sql`
    /* customer_net_ledger_balance */
    select (
      coalesce((select ob.opening_amount from customer_opening_balances ob
                where ob.customer_id = ${customerId}::uuid), 0)
      + coalesce((select sum(i.invoice_net_value) from invoices i
                  where i.customer_id = ${customerId}::uuid and i.approval_status <> 'rejected' and i.doc_status <> 'cancelled'), 0)
      - coalesce((select sum(col.collection_amount) from collections col
                  where col.customer_id = ${customerId}::uuid
                    and col.accountant_approval_status is distinct from 'rejected'), 0)
      - coalesce((select sum(sr.gross_amount) from sales_returns sr
                  where sr.customer_id = ${customerId}::uuid), 0)
    )::numeric as "ledgerBalance"
  `,
    // Overdue when PAST this customer's own terms — no company-wide grace. An
    // invoice is overdue once now is past its due_date; an opening once it has
    // aged past the customer's credit_days from as_of_date.
    sql`
    /* customer_overdue_past_terms */
    select
      exists(
        select 1 from invoices i
        where i.customer_id = ${customerId}::uuid
          and i.outstanding_amount > 0
          and (now() at time zone 'Asia/Kolkata')::date > i.due_date
      ) as "invoiceOverdue",
      exists(
        select 1 from customer_opening_balances ob
        join customers c on c.id = ob.customer_id
        where ob.customer_id = ${customerId}::uuid
          and ob.outstanding_amount > 0
          and ((now() at time zone 'Asia/Kolkata')::date - ob.as_of_date) > coalesce(c.credit_days, 0)
      ) as "openingOverdue"
  `,
  ]);

  const totalOutstanding = numberValue((ledgerRows as Row[])[0]?.ledgerBalance);
  const overdueRow = (overdueRows as Row[])[0];

  // Only block when the customer owes AND has debt overdue past the threshold.
  const creditBlocked =
    totalOutstanding > 0 && (overdueRow?.invoiceOverdue === true || overdueRow?.openingOverdue === true);

  return { creditBlocked, creditOverdueDays, totalOutstanding };
}

export async function listCustomerInvoices(
  sql: SqlClient,
  context: CustomerContext,
  customerId: string,
) {
  const customerRows = await sql`
    /* get_customer_for_invoices */
    select
      c.id,
      c.legal_name as "legalName",
      c.credit_limit as "creditLimit",
      c.credit_days as "creditDays"
    from customers c
    where c.id = ${customerId}::uuid
      and (${creatorScope(context)}::uuid is null or c.created_by = ${creatorScope(context)}::uuid)
    limit 1
  `;

  if (customerRows.length === 0) {
    throw new ApiError("NOT_FOUND", "Customer not found.", 404);
  }
  const customer = customerRows[0];

  const invoiceRows = await sql`
    /* list_customer_outstanding_invoices */
    select
      i.id,
      i.invoice_number as "invoiceNumber",
      i.invoice_date as "invoiceDate",
      i.due_date as "dueDate",
      i.invoice_net_value as "netInvoiceValue",
      i.amount_collected as "amountCollected",
      i.outstanding_amount as "outstandingAmount",
      i.payment_status as "paymentStatus",
      greatest(0, (now() at time zone 'Asia/Kolkata')::date - i.due_date) as "daysOverdue"
    from invoices i
    where i.customer_id = ${customerId}::uuid
      and i.outstanding_amount > 0
    order by i.due_date
  `;

  const invoices = invoiceRows.map((row: Row) => ({
    id: stringValue(row.id),
    invoiceNumber: stringValue(row.invoiceNumber),
    invoiceDate: dateStringValue(row.invoiceDate),
    dueDate: dateStringValue(row.dueDate),
    netInvoiceValue: numberValue(row.netInvoiceValue),
    amountCollected: numberValue(row.amountCollected),
    outstandingAmount: numberValue(row.outstandingAmount),
    paymentStatus: stringValue(row.paymentStatus),
    daysOverdue: numberValue(row.daysOverdue),
  }));

  // Advance credit held by the customer = verified money collected but not yet
  // allocated to any invoice (Σ verified collection_amount − Σ allocations).
  // This is money paid ahead; it offsets outstanding and can go past it.
  const [creditRow] = await sql`
    /* customer_held_advance_credit */
    select
      coalesce(sum(c.collection_amount), 0)
        - coalesce((
            select sum(ca.allocated_amount)
            from collection_allocations ca
            join collections c2 on c2.id = ca.collection_id
            where c2.customer_id = ${customerId}::uuid
              and c2.accountant_approval_status = 'verified'
          ), 0) as "heldCredit"
    from collections c
    where c.customer_id = ${customerId}::uuid
      and c.accountant_approval_status = 'verified'
  `;
  const advanceCredit = Math.max(0, numberValue(creditRow?.heldCredit));

  // Credit decision (block state + outstanding + threshold) comes from the shared
  // helper, so this list and the customer-detail header never disagree.
  const credit = await getCustomerCreditStatus(sql, customerId);

  return {
    customer: {
      id: stringValue(customer.id),
      legalName: stringValue(customer.legalName),
      creditLimit: numberValue(customer.creditLimit),
      creditDays: numberValue(customer.creditDays),
    },
    invoices,
    totalOutstanding: credit.totalOutstanding,
    advanceCredit,
    creditOverdueDays: credit.creditOverdueDays,
    creditBlocked: credit.creditBlocked,
  };
}

export async function getCustomerById(
  sql: SqlClient,
  context: CustomerContext,
  id: string,
) {
  const rows = await sql`
    /* get_customer_by_id */
    select
      c.id,
      c.customer_code as "customerCode",
      c.legal_name as "legalName",
      c.trade_name as "tradeName",
      c.customer_name as "customerName",
      c.customer_type as "customerType",
      c.segment,
      c.phone,
      c.alternative_phone as "alternativePhone",
      c.gst_number as "gstNumber",
      c.pan_number as "panNumber",
      c.aadhar_number as "aadharNumber",
      c.address_street as "addressStreet",
      c.address_city as "addressCity",
      c.address_state as "addressState",
      c.address_pincode as "addressPincode",
      c.address_landmark as "addressLandmark",
      c.email,
      c.customer_grade as "customerGrade",
      c.credit_limit as "creditLimit",
      c.credit_days as "creditDays",
      c.payment_status as "paymentStatus",
      c.kyc_status as "kycStatus",
      c.approval_status as "approvalStatus",
      c.status,
      -- Saved GPS: the mobile customer screen feeds these to the check-in geofence
      -- (without them the client "Too far from the shop" guard is skipped entirely).
      c.latitude,
      c.longitude,
      c.created_by as "createdBy",
      se.name as "salesExecutiveName",
      -- The REQUESTING user's visit to this customer TODAY (IST), if any — drives
      -- the mobile 3-state action button (Check in, Check out, Visited today) and
      -- survives an app reopen. todayVisitId is needed for the checkout POST.
      tv.id as "todayVisitId",
      (tv.id is not null) as "visitedToday",
      (tv.check_out_time is not null) as "todayVisitCheckedOut"
    from customers c
    left join users se on se.id = c.created_by
    left join lateral (
      select v.id, v.check_out_time
      from visits v
      where v.customer_id = c.id
        and v.executive_id = ${context.userId ?? null}::uuid
        and v.visit_date = (now() at time zone 'Asia/Kolkata')::date
      order by v.check_in_time desc nulls last
      limit 1
    ) tv on true
    where c.id = ${id}::uuid
      and (${creatorScope(context)}::uuid is null or c.created_by = ${creatorScope(context)}::uuid)
    limit 1
  `;

  if (rows.length === 0) {
    throw new ApiError("NOT_FOUND", "Customer not found.", 404);
  }

  // Fold the credit gate into the header so the mobile action row knows the
  // blocked state at first paint (no enabled-"Order"→"Blocked" flash). Same
  // helper the invoices list uses, so the two can never disagree.
  const credit = await getCustomerCreditStatus(sql, id);
  return { ...mapCustomerRow(rows[0]), ...credit };
}

/**
 * Restricted SE edit (decided 2026-07-10, phone added 2026-07-15): a
 * SALES_EXECUTIVE may update the address fields, GPS coordinates and phone,
 * and only on customers they created.
 */
export async function updateCustomerSeFields(
  sql: SqlClient,
  context: CustomerContext,
  id: string,
  input: {
    addressStreet?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPincode?: string | null;
    addressLandmark?: string | null;
    phone?: string | null;
    segment?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
) {
  // Block editing the phone to one that belongs to another customer — only when
  // it actually changes, so customers that share a historical number stay
  // editable. Explicit check gives a named message; the DB index (0070) backs it.
  if (input.phone != null) {
    const [cur] = (await sql`
      /* current_phone_for_edit */
      select right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) as "norm"
      from customers where id = ${id}::uuid
    `) as Row[];
    if (cur && normalizedPhone(input.phone) !== stringValue(cur.norm)) {
      await assertPhoneAvailable(sql, input.phone, id);
    }
  }

  let rows;
  try {
    rows = await sql`
    /* update_customer_se_fields */
    update customers
    set
      address_street  = coalesce(${input.addressStreet ?? null}, address_street),
      address_city    = coalesce(${input.addressCity ?? null}, address_city),
      address_state   = coalesce(${input.addressState ?? null}, address_state),
      address_pincode = coalesce(${input.addressPincode ?? null}, address_pincode),
      address_landmark = coalesce(${input.addressLandmark ?? null}, address_landmark),
      phone           = coalesce(${input.phone ?? null}, phone),
      segment         = coalesce(${input.segment ?? null}, segment),
      latitude        = coalesce(${input.latitude ?? null}, latitude),
      longitude       = coalesce(${input.longitude ?? null}, longitude),
      updated_at      = now()
    where id = ${id}::uuid
      and created_by = ${context.userId}::uuid
    returning
      id,
      customer_code as "customerCode",
      legal_name as "legalName",
      trade_name as "tradeName",
      customer_name as "customerName",
      customer_type as "customerType",
      segment,
      phone,
      alternative_phone as "alternativePhone",
      gst_number as "gstNumber",
      pan_number as "panNumber",
      aadhar_number as "aadharNumber",
      address_street as "addressStreet",
      address_city as "addressCity",
      address_state as "addressState",
      address_pincode as "addressPincode",
      address_landmark as "addressLandmark",
      email,
      customer_grade as "customerGrade",
      credit_limit as "creditLimit",
      credit_days as "creditDays",
      payment_status as "paymentStatus",
      kyc_status as "kycStatus",
      approval_status as "approvalStatus",
      status,
      created_by as "createdBy"
  `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate key|unique|23505/i.test(msg)) {
      throw new ApiError(
        "CONFLICT",
        "That phone number already belongs to another customer.",
        409,
      );
    }
    throw e;
  }

  if (rows.length === 0) {
    throw new ApiError("NOT_FOUND", "Customer not found.", 404);
  }
  return mapCustomerRow(rows[0]);
}

/** Last 10 digits of a phone number — tolerant of +91/spaces/dashes. */
function normalizedPhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/**
 * Throw a friendly 409 if `phone` (normalized to last 10 digits) already
 * belongs to another customer. Shared by create + both edit paths so the DB
 * unique index (migration 0070, active customers) can never surface as a raw
 * 500. `excludeId` is the customer being edited (skip self); null on create.
 */
async function assertPhoneAvailable(
  sql: SqlClient,
  phone: string,
  excludeId: string | null,
): Promise<void> {
  const digits = normalizedPhone(phone);
  if (digits.length < 10) {
    throw new ApiError("INVALID_FIELD", "Enter a valid 10-digit phone number.", 422);
  }
  const [dup] = (await sql`
    /* check_duplicate_phone */
    select customer_code as "customerCode", legal_name as "legalName"
    from customers
    where right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = ${digits}
      and id <> ${excludeId ?? "00000000-0000-0000-0000-000000000000"}::uuid
    limit 1
  `) as Row[];
  if (dup) {
    throw new ApiError(
      "CONFLICT",
      `This phone number already belongs to ${stringValue(dup.legalName)} (${stringValue(dup.customerCode)}).`,
      409,
    );
  }
}

/** Fetch an already-created customer by its idempotency key, or null when none.
 *  Lets a retried POST (after a timed-out create that actually committed) return
 *  the same record instead of a duplicate/phone-conflict. Column set mirrors the
 *  create `returning` clause so both map through `mapCustomerRow` identically. */
async function existingCustomerByClientUuid(sql: SqlClient, clientUuid: string) {
  const [row] = (await sql`
    /* get_customer_by_client_uuid */
    select
      id,
      customer_code as "customerCode",
      legal_name as "legalName",
      trade_name as "tradeName",
      customer_name as "customerName",
      customer_type as "customerType",
      segment,
      phone,
      alternative_phone as "alternativePhone",
      gst_number as "gstNumber",
      pan_number as "panNumber",
      aadhar_number as "aadharNumber",
      address_street as "addressStreet",
      address_city as "addressCity",
      address_state as "addressState",
      address_pincode as "addressPincode",
      address_landmark as "addressLandmark",
      email,
      customer_grade as "customerGrade",
      credit_limit as "creditLimit",
      credit_days as "creditDays",
      payment_status as "paymentStatus",
      kyc_status as "kycStatus",
      approval_status as "approvalStatus",
      status,
      created_by as "createdBy"
    from customers
    where client_uuid = ${clientUuid}::uuid
    limit 1
  `) as Row[];
  return row ? mapCustomerRow(row) : null;
}

/** Validate a new-customer payload (type + mandatory fields + phone shape) and
 *  return the normalized 10-digit phone. Throws 422 on the first problem. */
function assertValidNewCustomer(input: CreateCustomerInput): string {
  if (!VALID_CUSTOMER_TYPES.has(input.customerType)) {
    throw new ApiError(
      "INVALID_FIELD",
      `customerType must be one of: ${[...VALID_CUSTOMER_TYPES].join(", ")}.`,
      422,
    );
  }

  // Mandatory fields (decided 2026-07-12): business name (route-enforced),
  // phone, address (street/city/pincode) and credit terms.
  const missing: string[] = [];
  if (!input.phone?.trim()) missing.push("phone");
  if (!input.addressStreet?.trim()) missing.push("addressStreet");
  if (!input.addressCity?.trim()) missing.push("addressCity");
  if (!input.addressPincode?.trim()) missing.push("addressPincode");
  if (input.creditLimit === null || input.creditLimit === undefined) missing.push("creditLimit");
  if (input.creditDays === null || input.creditDays === undefined) missing.push("creditDays");
  if (missing.length > 0) {
    throw new ApiError("INVALID_FIELD", `Required fields missing: ${missing.join(", ")}.`, 422);
  }

  // One customer per phone number — compare on the last 10 digits so
  // "+91 98765 01234" and "9876501234" collide.
  const phoneDigits = normalizedPhone(input.phone!);
  if (phoneDigits.length < 10) {
    throw new ApiError("INVALID_FIELD", "Enter a valid 10-digit phone number.", 422);
  }
  return phoneDigits;
}

/** Reject a create whose phone (last 10 digits) already belongs to a customer. */
async function assertNewCustomerPhoneAvailable(sql: SqlClient, phoneDigits: string): Promise<void> {
  const [duplicate] = (await sql`
    /* check_duplicate_phone */
    select customer_code as "customerCode", legal_name as "legalName"
    from customers
    where right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = ${phoneDigits}
    limit 1
  `) as Row[];
  if (duplicate) {
    throw new ApiError(
      "CONFLICT",
      `This phone number already belongs to ${stringValue(duplicate.legalName)} (${stringValue(duplicate.customerCode)}).`,
      409,
    );
  }
}

/** Resolve + validate the owning SE (assigned on web, self on mobile). Every
 *  customer must belong to an active SALES_EXECUTIVE. Throws 422 otherwise. */
async function resolveActiveSeOwner(
  sql: SqlClient,
  context: CustomerContext,
  input: CreateCustomerInput,
): Promise<string> {
  const ownerId = input.salesExecutiveId ?? context.userId;
  const [owner] = (await sql`
    /* validate_owner_is_se */
    select 1 as ok
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where u.id = ${ownerId}::uuid and u.status = 'active' and r.code = 'SALES_EXECUTIVE'
    limit 1
  `) as Row[];
  if (!owner) {
    throw new ApiError("INVALID_FIELD", "Assign the customer to an active sales executive.", 422);
  }
  return ownerId;
}

export async function createCustomer(
  sql: SqlClient,
  context: CustomerContext,
  input: CreateCustomerInput,
) {
  // Idempotent replay: a repeat POST with the same clientUuid (a 15s-timeout
  // retry whose first attempt actually committed server-side) returns the
  // already-created customer rather than inserting again or 409-ing on phone.
  if (input.clientUuid) {
    const existing = await existingCustomerByClientUuid(sql, input.clientUuid);
    if (existing) return existing;
  }

  const phoneDigits = assertValidNewCustomer(input);
  await assertNewCustomerPhoneAvailable(sql, phoneDigits);
  const ownerId = await resolveActiveSeOwner(sql, context, input);

  // The CUST-#### code is max(seq)+1 — race-prone under concurrent creates — so
  // code generation + the insert are retried on a customer_code collision.
  const runInsert = async (): Promise<Row[]> => {
    const [codeRow] = await sql`
      /* next_customer_code */
      select coalesce(max(substring(customer_code from 6)::int), 0) + 1 as next_seq
      from customers
      where customer_code ~ '^CUST-[0-9]+$'
    `;
    const seq = numberValue(codeRow?.next_seq ?? 1);
    const customerCode = `CUST-${String(seq).padStart(4, "0")}`;
    return (await sql`
    /* create_customer */
    insert into customers (
      customer_code,
      legal_name,
      trade_name,
      customer_name,
      customer_type,
      segment,
      phone,
      alternative_phone,
      gst_number,
      pan_number,
      aadhar_number,
      address_street,
      address_city,
      address_state,
      address_pincode,
      address_landmark,
      email,
      customer_grade,
      credit_limit,
      credit_days,
      latitude,
      longitude,
      approval_status,
      status,
      created_by,
      client_uuid
    )
    values (
      ${customerCode},
      ${input.legalName},
      ${input.tradeName},
      ${input.customerName},
      ${input.customerType},
      ${input.segment},
      ${input.phone},
      ${input.alternativePhone},
      ${input.gstNumber},
      ${input.panNumber},
      ${input.aadharNumber},
      ${input.addressStreet},
      ${input.addressCity},
      ${input.addressState},
      ${input.addressPincode},
      ${input.addressLandmark},
      ${input.email},
      ${input.customerGrade},
      ${input.creditLimit ?? 0},
      ${input.creditDays ?? 0},
      ${input.latitude ?? null},
      ${input.longitude ?? null},
      'approved',
      'active',
      ${ownerId},
      ${input.clientUuid ?? null}
    )
    returning
      id,
      customer_code as "customerCode",
      legal_name as "legalName",
      trade_name as "tradeName",
      customer_name as "customerName",
      customer_type as "customerType",
      segment,
      phone,
      alternative_phone as "alternativePhone",
      gst_number as "gstNumber",
      pan_number as "panNumber",
      aadhar_number as "aadharNumber",
      address_street as "addressStreet",
      address_city as "addressCity",
      address_state as "addressState",
      address_pincode as "addressPincode",
      address_landmark as "addressLandmark",
      email,
      customer_grade as "customerGrade",
      credit_limit as "creditLimit",
      credit_days as "creditDays",
      payment_status as "paymentStatus",
      kyc_status as "kycStatus",
      approval_status as "approvalStatus",
      status,
      created_by as "createdBy"
    `) as Row[];
  };

  try {
    const [row] = await retryOnUniqueViolation(runInsert, {
      constraint: "customers_customer_code_key",
    });
    return mapCustomerRow(row);
  } catch (err) {
    // Concurrent retry with the same idempotency key won the race — return the
    // row it created instead of surfacing the unique violation as a 500.
    if (input.clientUuid && isUniqueViolation(err, "customers_client_uuid_unique")) {
      const existing = await existingCustomerByClientUuid(sql, input.clientUuid);
      if (existing) return existing;
    }
    throw err;
  }
}

export async function updateCustomer(
  sql: SqlClient,
  context: CustomerContext,
  id: string,
  input: UpdateCustomerInput,
) {
  // Same duplicate-phone guard as the SE edit path (only when the phone changes).
  if (input.phone != null) {
    const [cur] = (await sql`
      /* current_phone_for_edit */
      select right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) as "norm"
      from customers where id = ${id}::uuid
    `) as Row[];
    if (cur && normalizedPhone(input.phone) !== stringValue(cur.norm)) {
      await assertPhoneAvailable(sql, input.phone, id);
    }
  }

  const [row] = await sql`
    /* update_customer */
    update customers
    set
      legal_name        = coalesce(${input.legalName}, legal_name),
      trade_name        = coalesce(${input.tradeName}, trade_name),
      customer_name     = coalesce(${input.customerName}, customer_name),
      customer_type     = coalesce(${input.customerType}, customer_type),
      segment           = coalesce(${input.segment}, segment),
      phone             = coalesce(${input.phone}, phone),
      alternative_phone = coalesce(${input.alternativePhone}, alternative_phone),
      gst_number        = coalesce(${input.gstNumber}, gst_number),
      pan_number        = coalesce(${input.panNumber}, pan_number),
      aadhar_number     = coalesce(${input.aadharNumber}, aadhar_number),
      address_street    = coalesce(${input.addressStreet}, address_street),
      address_city      = coalesce(${input.addressCity}, address_city),
      address_state     = coalesce(${input.addressState}, address_state),
      address_pincode   = coalesce(${input.addressPincode}, address_pincode),
      address_landmark  = coalesce(${input.addressLandmark}, address_landmark),
      email             = coalesce(${input.email}, email),
      customer_grade    = coalesce(${input.customerGrade}, customer_grade),
      credit_limit      = coalesce(${input.creditLimit}, credit_limit),
      credit_days       = coalesce(${input.creditDays}, credit_days),
      updated_at        = now()
    where id = ${id}::uuid
    returning
      id,
      customer_code as "customerCode",
      legal_name as "legalName",
      trade_name as "tradeName",
      customer_name as "customerName",
      customer_type as "customerType",
      segment,
      phone,
      alternative_phone as "alternativePhone",
      gst_number as "gstNumber",
      pan_number as "panNumber",
      aadhar_number as "aadharNumber",
      address_street as "addressStreet",
      address_city as "addressCity",
      address_state as "addressState",
      address_pincode as "addressPincode",
      address_landmark as "addressLandmark",
      email,
      customer_grade as "customerGrade",
      credit_limit as "creditLimit",
      credit_days as "creditDays",
      payment_status as "paymentStatus",
      kyc_status as "kycStatus",
      approval_status as "approvalStatus",
      status,
      created_by as "createdBy"
  `;

  if (!row) {
    throw new ApiError("NOT_FOUND", "Customer not found.", 404);
  }

  return mapCustomerRow(row);
}

export async function updateCustomerStatus(
  sql: SqlClient,
  context: CustomerContext,
  id: string,
  status: string,
) {
  if (!VALID_STATUSES.has(status)) {
    throw new ApiError(
      "INVALID_FIELD",
      `status must be one of: ${[...VALID_STATUSES].join(", ")}.`,
      422,
    );
  }

  const [row] = await sql`
    /* update_customer_status */
    update customers
    set status = ${status}, updated_at = now()
    where id = ${id}::uuid
    returning
      id,
      customer_code as "customerCode",
      legal_name as "legalName",
      trade_name as "tradeName",
      customer_name as "customerName",
      customer_type as "customerType",
      segment,
      phone,
      alternative_phone as "alternativePhone",
      gst_number as "gstNumber",
      pan_number as "panNumber",
      aadhar_number as "aadharNumber",
      address_street as "addressStreet",
      address_city as "addressCity",
      address_state as "addressState",
      address_pincode as "addressPincode",
      address_landmark as "addressLandmark",
      email,
      customer_grade as "customerGrade",
      credit_limit as "creditLimit",
      credit_days as "creditDays",
      payment_status as "paymentStatus",
      kyc_status as "kycStatus",
      approval_status as "approvalStatus",
      status,
      created_by as "createdBy"
  `;

  if (!row) {
    throw new ApiError("NOT_FOUND", "Customer not found.", 404);
  }

  return mapCustomerRow(row);
}

// ── Customer ledger (per-customer running statement) ───────────────────────────
// A single statement combining invoices (Sales → Debit) and collections
// (Receipts → Credit) with a running Dr/Cr balance, matching the client's ledger
// PDF. Opening balance = everything before `from`; rejected invoices/collections
// are excluded. Managers may view this (the one place they see invoice amounts).

