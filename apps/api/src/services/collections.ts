import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";
import type { Role } from "../types";
import { isUniqueViolation, retryOnUniqueViolation } from "../lib/pg-errors";
import { recomputeCustomerBalances } from "./reconcile-recompute";
import { resolvePage, resolveSort } from "../lib/pagination";
import { customerOwnerSE } from "./orders";
import {
  allocateOldestFirst,
  capAndSpillExplicit,
  type ExplicitAllocation,
  type InvoiceTarget,
} from "./opening-balance-fifo";
import {
  applyAllocationToOpening,
  getOpeningTarget,
  reverseAllocationFromOpening,
} from "./opening-balance";
import {
  type CollectionContext,
  type CreateCollectionInput,
  type ListCollectionsFilters,
  type PagedCollectionsParams,
  type Row,
  str,
  strOrNull,
  numStr,
  bool,
  mapCollectionRow,
  mapAllocationRow,
  COLLECTION_LIST_COLUMNS,
  COLLECTION_FROM,
  COLLECTION_SORTS,
} from "./collections-shared";

// The collections service is split (audit G-0104): the shared foundation
// (context/helpers/mappers/SQL) lives in ./collections-shared. Re-export the
// types so callers of ../services/collections are unchanged.
export type {
  CreateCollectionInput,
  ListCollectionsFilters,
  PagedCollectionsParams,
} from "./collections-shared";

export const VALID_PAYMENT_MODES = new Set(["cash", "cheque", "upi", "neft_rtgs", "credit_note"]);
export const VALID_COLLECTION_TYPES = new Set(["general", "advance"]);


/**
 * Active users who can be credited as the collector on a web-recorded
 * collection ("who actually collected the money"). Includes all field staff
 * (Sales Executives, Logistics) and office users — anyone plausibly handling
 * cash. Each carries a role label so the dropdown can group/disambiguate.
 */
export async function listCollectors(sql: SqlClient) {
  const rows = await sql`
    /* list_collectors */
    select
      u.id,
      u.name,
      coalesce(
        min(case r.code
          when 'SALES_EXECUTIVE' then '1'
          when 'LOGISTICS' then '2'
          else '3' end),
        '3'
      ) as rank,
      string_agg(distinct r.code, ',') as roles
    from users u
    left join user_roles ur on ur.user_id = u.id
    left join roles r on r.id = ur.role_id
    where u.status = 'active'
    group by u.id, u.name
    order by rank, u.name
  `;
  const label = (roles: string | null): string => {
    if (!roles) return "";
    if (roles.includes("SALES_EXECUTIVE")) return "Sales Executive";
    if (roles.includes("LOGISTICS")) return "Logistics";
    if (roles.includes("SUPER_ADMIN")) return "Super Admin";
    if (roles.includes("MANAGER")) return "Manager";
    if (roles.includes("ACCOUNTANT")) return "Accountant";
    return "";
  };
  return rows.map((row: Row) => ({
    id: str(row.id),
    name: str(row.name),
    roleLabel: label(strOrNull(row.roles)),
  }));
}


export async function listCollections(
  sql: SqlClient,
  _context: CollectionContext,
  filters: ListCollectionsFilters = {},
) {
  const rows = await sql`
    /* list_collections */
    select
      c.id,
      c.collection_code as "collectionCode",
      c.collection_date as "collectionDate",
      c.customer_id as "customerId",
      cu.legal_name as "customerName",
      cu.address_city as "customerCity",
      cu.phone as "customerPhone",
      c.collected_by_user_id as "collectedByUserId",
      u.name as "collectedByName",
      c.payment_mode as "paymentMode",
      c.collection_type as "collectionType",
      c.payment_reference_number as "paymentReferenceNumber",
      c.collection_amount as "collectionAmount",
      c.cheque_date as "chequeDate",
      c.cheque_status as "chequeStatus",
      c.bank_name as "bankName",
      c.matched_status as "matchedStatus",
      c.accountant_approval_status as "accountantApprovalStatus",
      c.approved_by_accountant_id as "approvedByAccountantId",
      c.approved_at as "approvedAt",
      c.incentive_eligible as "incentiveEligible",
      c.remarks,
      c.created_by as "createdBy",
      c.created_at as "createdAt",
      c.updated_at as "updatedAt",
      c.client_uuid as "clientUuid"
    from collections c
    left join customers cu on cu.id = c.customer_id
    left join users u on u.id = c.collected_by_user_id
    where (${filters.status ?? null}::text is null or c.accountant_approval_status = ${filters.status ?? null})
      and (${filters.collectedBy ?? null}::text is null or c.collected_by_user_id = ${filters.collectedBy ?? null}::uuid)
      and (${filters.customerId ?? null}::text is null or c.customer_id = ${filters.customerId ?? null}::uuid)
      and (${filters.fromDate ?? null}::text is null or c.collection_date >= ${filters.fromDate ?? null}::date)
      and (${filters.toDate ?? null}::text is null or c.collection_date <= ${filters.toDate ?? null}::date)
    order by c.collection_date desc, c.created_at desc
  `;
  return rows.map(mapCollectionRow);
}


/**
 * Server-side filtered/sorted/paginated collections for the web table (table
 * standard). The plain `listCollections` (array) stays for mobile + other use.
 */
export async function listCollectionsPaged(
  sql: SqlClient,
  _context: CollectionContext,
  opts: PagedCollectionsParams,
) {
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (cond: (p: string) => string, value: unknown) => {
    params.push(value);
    conds.push(cond(`$${params.length}`));
  };
  const status = (opts.status ?? "").trim();
  if (status) add((p) => `c.accountant_approval_status = ${p}`, status);
  const customerId = (opts.customerId ?? "").trim();
  if (customerId) add((p) => `c.customer_id = ${p}::uuid`, customerId);
  const collectedBy = (opts.collectedBy ?? "").trim();
  if (collectedBy) add((p) => `c.collected_by_user_id = ${p}::uuid`, collectedBy);
  const fromDate = (opts.fromDate ?? "").trim();
  if (fromDate) add((p) => `c.collection_date >= ${p}::date`, fromDate);
  const toDate = (opts.toDate ?? "").trim();
  if (toDate) add((p) => `c.collection_date <= ${p}::date`, toDate);
  const search = (opts.search ?? "").trim();
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    conds.push(`(c.collection_code ilike ${p} or cu.legal_name ilike ${p})`);
  }
  const whereSql = conds.length ? `where ${conds.join(" and ")}` : "";

  const sort = resolveSort(opts.sort, opts.dir, COLLECTION_SORTS, "collectionDate");
  const { limit, offset, page, pageSize } = resolvePage(opts.page, opts.pageSize);

  // Count and page are independent — one parallel batch, not two sequential
  // ~50ms round-trips.
  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* list_collections_paged_count */ select count(*)::int as total ${COLLECTION_FROM} ${whereSql}`,
      params,
    ),
    sql.query(
      `/* list_collections_paged */
     select ${COLLECTION_LIST_COLUMNS} ${COLLECTION_FROM} ${whereSql}
     order by ${sort.expr} ${sort.dir} nulls last, c.created_at desc
     limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);
  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return {
    rows: rows.map(mapCollectionRow),
    total: Number(countRow?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getCollectionById(
  sql: SqlClient,
  context: { userId: string; role?: Role | null },
  id: string,
) {
  // SE visibility: a SALES_EXECUTIVE may read a collection only if they collected
  // it OR it belongs to a customer they own; office roles (null scope) see all.
  // A non-visible/unknown id returns 404 below — "not yours" is indistinguishable
  // from "doesn't exist", matching the list-endpoint scoping.
  const scope = context.role === "SALES_EXECUTIVE" ? context.userId : null;
  const [row] = await sql`
    /* get_collection_by_id */
    select
      c.id,
      c.collection_code as "collectionCode",
      c.collection_date as "collectionDate",
      c.customer_id as "customerId",
      cu.legal_name as "customerName",
      c.collected_by_user_id as "collectedByUserId",
      u.name as "collectedByName",
      c.payment_mode as "paymentMode",
      c.collection_type as "collectionType",
      c.payment_reference_number as "paymentReferenceNumber",
      c.collection_amount as "collectionAmount",
      c.cheque_date as "chequeDate",
      c.cheque_status as "chequeStatus",
      c.bank_name as "bankName",
      c.matched_status as "matchedStatus",
      c.accountant_approval_status as "accountantApprovalStatus",
      c.approved_by_accountant_id as "approvedByAccountantId",
      au.name as "approvedByAccountantName",
      c.approved_at as "approvedAt",
      c.incentive_eligible as "incentiveEligible",
      c.remarks,
      c.created_by as "createdBy",
      c.created_at as "createdAt",
      c.updated_at as "updatedAt"
    from collections c
    left join customers cu on cu.id = c.customer_id
    left join users u on u.id = c.collected_by_user_id
    left join users au on au.id = c.approved_by_accountant_id
    where c.id = ${id}::uuid
      and (${scope}::uuid is null
           or c.collected_by_user_id = ${scope}::uuid
           or cu.created_by = ${scope}::uuid)
  `;

  if (!row) throw new ApiError("NOT_FOUND", "Collection not found.", 404);

  const allocations = await sql`
    /* get_collection_allocations */
    select
      ca.id,
      ca.collection_id as "collectionId",
      ca.invoice_id as "invoiceId",
      ca.opening_balance_id as "openingBalanceId",
      i.invoice_number as "invoiceNumber",
      ca.allocated_amount as "allocatedAmount"
    from collection_allocations ca
    left join invoices i on i.id = ca.invoice_id
    where ca.collection_id = ${id}::uuid
    order by ca.allocated_at
  `;

  // The SE-uploaded receipt photo (one per collection), if any. Web-created
  // collections have none; only the metadata is returned — the bytes stream
  // from GET /collections/:id/proof.
  const [proof] = await sql`
    /* get_collection_proof_meta */
    select id, content_type as "contentType", created_at as "createdAt"
    from payment_proofs
    where collection_id = ${id}::uuid
    order by created_at
    limit 1
  `;

  return {
    ...mapCollectionRow(row),
    allocations: allocations.map(mapAllocationRow),
    proof: proof
      ? {
          id: str(proof.id),
          contentType: str(proof.contentType),
          createdAt: str(proof.createdAt),
        }
      : null,
  };
}

/**
 * Fetch an already-created collection by clientUuid, mapped for the create
 * response with `existing: true`, or null. Shared by the up-front idempotent
 * replay check AND the concurrent-race recovery below.
 */
async function existingCollectionByClientUuid(sql: SqlClient, clientUuid: string) {
  const [existing] = await sql`
    /* get_collection_by_client_uuid */
    select
      id,
      collection_code as "collectionCode",
      collection_date as "collectionDate",
      customer_id as "customerId",
      collected_by_user_id as "collectedByUserId",
      payment_mode as "paymentMode",
      payment_reference_number as "paymentReferenceNumber",
      collection_amount as "collectionAmount",
      cheque_date as "chequeDate",
      cheque_status as "chequeStatus",
      bank_name as "bankName",
      matched_status as "matchedStatus",
      accountant_approval_status as "accountantApprovalStatus",
      approved_by_accountant_id as "approvedByAccountantId",
      approved_at as "approvedAt",
      incentive_eligible as "incentiveEligible",
      remarks,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from collections
    where client_uuid = ${clientUuid}::uuid
  `;
  return existing ? { ...mapCollectionRow(existing), existing: true } : null;
}

export async function createCollection(
  sql: SqlClient,
  context: CollectionContext,
  input: CreateCollectionInput,
) {
  // Idempotent replay: a mobile client retrying an offline-queued collection
  // sends the same clientUuid — return the already-created collection.
  if (input.clientUuid) {
    const existing = await existingCollectionByClientUuid(sql, input.clientUuid);
    if (existing) return existing;
  }

  // Validate the allocation target before creating anything.
  if (input.invoiceId) {
    const [invoice] = await sql`
      /* get_invoice_for_allocation */
      select id, customer_id as "customerId"
      from invoices
      where id = ${input.invoiceId}::uuid and doc_status <> 'cancelled'
    `;
    if (!invoice || str(invoice.customerId) !== input.customerId) {
      throw new ApiError(
        "INVALID_FIELD",
        "invoiceId must be an invoice of the same customer.",
        422,
      );
    }
  }

  // Attribute to the customer's owning SE when no collector was named (a Super
  // Admin recording a collection on mobile). An SE recording their own already
  // has collectedByUserId set upstream. Falls back to the creator only if the
  // customer somehow has no SE owner. Not racy → computed once, outside the retry.
  const collectedByUserId =
    input.collectedByUserId ?? (await customerOwnerSE(sql, input.customerId)) ?? context.userId;

  // The COLL-#### code is max(seq)+1 — race-prone under concurrent creates — so
  // code generation + the insert are retried on a collection_code collision.
  const runInsert = async (): Promise<Row[][]> => {
    const [codeRow] = await sql`
      /* next_collection_code */
      select coalesce(max(substring(collection_code from 6)::int), 0) + 1 as next_seq
      from collections
      where collection_code ~ '^COLL-[0-9]+$'
    `;
    const seq = typeof codeRow?.next_seq === "number" ? codeRow.next_seq : Number(codeRow?.next_seq ?? 1);
    const collectionCode = `COLL-${String(seq).padStart(4, "0")}`;
    // App-generated id so the (optional) allocation can reference it inside the
    // SAME transaction — collection + its allocation commit atomically.
    const collectionId = crypto.randomUUID();
    const statements = [
      sql`
    /* create_collection */
    insert into collections (
      id,
      collection_code,
      collection_date,
      customer_id,
      collected_by_user_id,
      payment_mode,
      collection_type,
      payment_reference_number,
      collection_amount,
      cheque_date,
      bank_name,
      remarks,
      created_by,
      client_uuid
    ) values (
      ${collectionId}::uuid,
      ${collectionCode},
      ${input.collectionDate}::date,
      ${input.customerId}::uuid,
      ${collectedByUserId}::uuid,
      ${input.paymentMode},
      ${input.collectionType},
      ${input.paymentReferenceNumber},
      ${input.collectionAmount},
      ${input.chequeDate ? sql`${input.chequeDate}::date` : sql`null`},
      ${input.bankName},
      ${input.remarks},
      ${context.userId}::uuid,
      ${input.clientUuid ?? null}::uuid
    )
    returning
      id,
      collection_code as "collectionCode",
      collection_date as "collectionDate",
      customer_id as "customerId",
      collected_by_user_id as "collectedByUserId",
      payment_mode as "paymentMode",
      collection_type as "collectionType",
      payment_reference_number as "paymentReferenceNumber",
      collection_amount as "collectionAmount",
      cheque_date as "chequeDate",
      cheque_status as "chequeStatus",
      bank_name as "bankName",
      matched_status as "matchedStatus",
      accountant_approval_status as "accountantApprovalStatus",
      approved_by_accountant_id as "approvedByAccountantId",
      approved_at as "approvedAt",
      incentive_eligible as "incentiveEligible",
      remarks,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    `,
    ];
    if (input.invoiceId) {
      statements.push(sql`
        /* create_collection_allocation */
        insert into collection_allocations (collection_id, invoice_id, allocated_amount)
        values (${collectionId}::uuid, ${input.invoiceId}::uuid, ${input.collectionAmount})
      `);
    }
    return (await sql.transaction(statements)) as Row[][];
  };

  let results: Row[][];
  try {
    results = await retryOnUniqueViolation(runInsert, {
      constraint: "collections_collection_code_key",
    });
  } catch (err) {
    // Concurrent idempotent replay: two retries of the same offline collection
    // raced past the SELECT; one committed first and this one hit the client_uuid
    // unique index. Return the winner instead of a 500.
    if (input.clientUuid && isUniqueViolation(err, "collections_client_uuid_unique")) {
      const existing = await existingCollectionByClientUuid(sql, input.clientUuid);
      if (existing) return existing;
    }
    throw err;
  }
  const row = results[0][0];

  // A pending collection already reduces the customer's balance (non-rejected),
  // so recompute per-invoice outstanding now. The collection + its allocation
  // committed atomically inside runInsert above.
  await recomputeCustomerBalances(sql, input.customerId);
  return { ...mapCollectionRow(row), existing: false };
}

export async function verifyCollection(
  sql: SqlClient,
  context: CollectionContext,
  id: string,
) {
  const [row] = await sql`
    /* verify_collection */
    update collections
    set
      accountant_approval_status = 'verified',
      approved_by_accountant_id = ${context.userId}::uuid,
      approved_at = now(),
      updated_at = now()
    where id = ${id}::uuid
      and accountant_approval_status = 'pending'
    returning
      id,
      collection_code as "collectionCode",
      collection_date as "collectionDate",
      customer_id as "customerId",
      collected_by_user_id as "collectedByUserId",
      payment_mode as "paymentMode",
      collection_type as "collectionType",
      payment_reference_number as "paymentReferenceNumber",
      collection_amount as "collectionAmount",
      cheque_date as "chequeDate",
      cheque_status as "chequeStatus",
      bank_name as "bankName",
      matched_status as "matchedStatus",
      accountant_approval_status as "accountantApprovalStatus",
      approved_by_accountant_id as "approvedByAccountantId",
      approved_at as "approvedAt",
      incentive_eligible as "incentiveEligible",
      remarks,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) {
    const [existing] = await sql`
      /* get_collection_verify_status */
      select id, accountant_approval_status as "status"
      from collections
      where id = ${id}::uuid
    `;
    if (!existing) throw new ApiError("NOT_FOUND", "Collection not found.", 404);
    throw new ApiError("CONFLICT", `Collection is already ${existing.status}.`, 409);
  }

  // Reconciliation happens at accountant approval (COLLECTION-RULES.md):
  // the verified money is applied to the customer's invoices so outstanding
  // amounts — and the credit gate that reads them — reflect reality.
  await reconcileCollection(
    sql,
    context,
    id,
    str(row.customerId),
    Number(row.collectionAmount),
  );

  // Any advance credit the customer holds (this collection's leftover, or an
  // earlier advance) auto-applies to still-open invoices, oldest-due-first.
  await applyHeldCreditToOpenInvoices(sql, context, str(row.customerId));
  // Authoritative per-invoice recompute from ground truth (supersedes the
  // incremental reconcile above so outstanding can never drift).
  await recomputeCustomerBalances(sql, str(row.customerId));

  // Return the fully-enriched detail (customer + collector + verifier names,
  // fresh allocations) so the caller doesn't lose the joined fields.
  return getCollectionById(sql, context, id);
}

type CreditTarget = { kind: "opening" | "invoice"; id: string; remaining: number };

/** Record one held-credit consumption against a target (opening balance or
 *  invoice): the `collection_allocations` row + the target's outstanding drop. */
async function allocateCreditTo(
  sql: SqlClient,
  context: CollectionContext,
  creditId: string,
  target: CreditTarget,
  applied: number,
): Promise<void> {
  if (target.kind === "opening") {
    await sql`
      /* create_credit_allocation_opening */
      insert into collection_allocations (collection_id, opening_balance_id, allocated_amount, allocated_by)
      values (${creditId}::uuid, ${target.id}::uuid, ${applied}, ${context.userId}::uuid)
    `;
    await applyAllocationToOpening(sql, target.id, applied);
  } else {
    await sql`
      /* create_credit_allocation */
      insert into collection_allocations (collection_id, invoice_id, allocated_amount, allocated_by)
      values (${creditId}::uuid, ${target.id}::uuid, ${applied}, ${context.userId}::uuid)
    `;
    await applyAllocationToInvoice(sql, target.id, applied);
  }
}

/**
 * Consumes a customer's unallocated (held) advance credit against their open
 * invoices, oldest-due-first. Each consumption is recorded as a
 * `collection_allocations` row against the originating collection, so the
 * "held credit = collection_amount − Σ allocations" invariant stays true and
 * the invoice outstanding drops. Idempotent: a no-op when there is no held
 * credit or no open invoice. Reusable from a future invoice-creation flow to
 * honour "advance auto-applies to new invoices".
 */
export async function applyHeldCreditToOpenInvoices(
  sql: SqlClient,
  context: CollectionContext,
  customerId: string,
): Promise<void> {
  // Verified collections that still hold unallocated money, oldest first.
  const creditRows = await sql`
    /* list_held_credit_sources */
    select
      c.id,
      c.collection_amount - coalesce(sum(ca.allocated_amount), 0) as "remaining"
    from collections c
    left join collection_allocations ca on ca.collection_id = c.id
    where c.customer_id = ${customerId}::uuid
      and c.accountant_approval_status = 'verified'
    group by c.id, c.collection_amount, c.collection_date, c.created_at
    having c.collection_amount - coalesce(sum(ca.allocated_amount), 0) > 0
    order by c.collection_date, c.created_at
  `;

  const credits = creditRows.map((r) => ({ id: str(r.id), remaining: Number(r.remaining) }));
  if (credits.every((c) => c.remaining <= 0)) return;

  // Targets, oldest debt first: the OPENING BALANCE (if any) then invoices
  // oldest-due-first — same priority the reconcile path uses.
  const opening = await getOpeningTarget(sql, customerId);
  const open = await sql`
    /* list_open_invoices_for_credit */
    select id, outstanding_amount as "outstandingAmount"
    from invoices
    where customer_id = ${customerId}::uuid
      and outstanding_amount > 0
    order by due_date asc nulls last, created_at
  `;
  const targets: CreditTarget[] = [];
  if (opening) targets.push({ kind: "opening", id: opening.id, remaining: opening.outstanding });
  for (const inv of open) {
    targets.push({ kind: "invoice", id: str(inv.id), remaining: Number(inv.outstandingAmount) });
  }

  let ci = 0;
  for (const target of targets) {
    while (target.remaining > 0 && ci < credits.length) {
      const credit = credits[ci];
      if (credit.remaining <= 0) {
        ci += 1;
        continue;
      }
      const applied = Math.min(target.remaining, credit.remaining);
      await allocateCreditTo(sql, context, credit.id, target, applied);
      credit.remaining -= applied;
      target.remaining -= applied;
    }
    if (ci >= credits.length) break;
  }
}

/** The invoice-apply UPDATE as an un-awaited fragment, so it can be run standalone
 *  (applyAllocationToInvoice) or batched into a sql.transaction (reconcile). It is
 *  a pure relative update, so batching many is safe (audit G-0403). */
function applyToInvoiceStmt(sql: SqlClient, invoiceId: string, amount: number) {
  return sql`
    /* apply_allocation_to_invoice */
    update invoices
    set amount_collected   = amount_collected + ${amount},
        outstanding_amount = greatest(0, outstanding_amount - ${amount}),
        payment_status     = case
          when outstanding_amount - ${amount} <= 0 then 'paid'
          else 'partially_paid'
        end,
        updated_at = now()
    where id = ${invoiceId}::uuid
  `;
}

async function applyAllocationToInvoice(
  sql: SqlClient,
  invoiceId: string,
  amount: number,
): Promise<void> {
  await applyToInvoiceStmt(sql, invoiceId, amount);
}

export interface UpdateCollectionInput {
  collectionDate: string;
  paymentMode: string;
  collectionAmount: number;
  paymentReferenceNumber: string | null;
  remarks: string | null;
}

/** Undo a collection's applied allocations: add each allocated amount back to
 *  its invoice's outstanding and drop the allocation rows. Used before editing a
 *  verified collection, which is then re-reconciled with the corrected amount. */
async function reverseCollectionAllocations(sql: SqlClient, collectionId: string): Promise<void> {
  const allocs = await sql`
    /* list_allocations_to_reverse */
    select invoice_id as "invoiceId", opening_balance_id as "openingBalanceId", allocated_amount as "allocatedAmount"
    from collection_allocations where collection_id = ${collectionId}::uuid
  `;
  for (const a of allocs) {
    const amt = Number(a.allocatedAmount);
    if (a.openingBalanceId) {
      // Allocation was applied to the opening balance — restore it there.
      await reverseAllocationFromOpening(sql, str(a.openingBalanceId), amt);
    } else {
      await sql`
        /* reverse_allocation_from_invoice */
        update invoices set
          amount_collected   = greatest(0, amount_collected - ${amt}),
          outstanding_amount = outstanding_amount + ${amt},
          payment_status     = case when amount_collected - ${amt} <= 0 then 'unpaid' else 'partially_paid' end,
          updated_at = now()
        where id = ${str(a.invoiceId)}::uuid
      `;
    }
  }
  await sql`delete from collection_allocations where collection_id = ${collectionId}::uuid`;
}

/**
 * Edit a collection (receipt or credit note) — a SUPER_ADMIN correction of a
 * mistyped entry. If the collection is already verified, its applied allocations
 * are reversed, the fields updated, then it is re-reconciled with the corrected
 * amount (and any freed/added held credit re-applied) so invoice outstanding
 * stays correct. A rejected collection cannot be edited. Note: a previously
 * explicit single-invoice allocation becomes a general (oldest-due) allocation
 * after an edit.
 */
export async function updateCollection(
  sql: SqlClient,
  context: CollectionContext,
  id: string,
  input: UpdateCollectionInput,
) {
  const amount = Number(input.collectionAmount);
  if (!(amount > 0)) throw new ApiError("INVALID_FIELD", "Amount must be greater than 0.", 422);
  if (!VALID_PAYMENT_MODES.has(input.paymentMode)) {
    throw new ApiError("INVALID_FIELD", "Invalid payment mode.", 422);
  }

  const [existing] = await sql`
    /* get_collection_for_update */
    select id, customer_id as "customerId", accountant_approval_status as "status"
    from collections where id = ${id}::uuid
  `;
  if (!existing) throw new ApiError("NOT_FOUND", "Collection not found.", 404);
  if (str(existing.status) === "rejected") {
    throw new ApiError("CONFLICT", "A rejected collection can't be edited.", 409);
  }
  const verified = str(existing.status) === "verified";
  const customerId = str(existing.customerId);

  // Verified money is already applied to invoices — undo it, then re-apply with
  // the corrected amount so outstanding balances stay consistent.
  if (verified) await reverseCollectionAllocations(sql, id);

  await sql`
    /* update_collection */
    update collections set
      collection_date          = ${input.collectionDate}::date,
      payment_mode             = ${input.paymentMode},
      collection_amount        = ${amount},
      payment_reference_number = ${input.paymentReferenceNumber},
      remarks                  = ${input.remarks},
      updated_at               = now()
    where id = ${id}::uuid
  `;

  if (verified) {
    await reconcileCollection(sql, context, id, customerId, amount);
    await applyHeldCreditToOpenInvoices(sql, context, customerId);
  }

  await recomputeCustomerBalances(sql, customerId);
  return getCollectionById(sql, context, id);
}

/** Apply explicit (app-chosen) allocations, each CAPPED at its invoice's
 *  outstanding; over-cap amounts spill oldest-first. Returns the spilled excess
 *  still to auto-allocate. The cap math is the pure, unit-tested capAndSpillExplicit(). */
async function applyExplicitAllocations(sql: SqlClient, collectionId: string, explicit: Row[]): Promise<number> {
  const targets: ExplicitAllocation[] = [];
  for (const alloc of explicit) {
    const invId = str(alloc.invoiceId);
    const [inv] = (await sql`
      /* explicit_alloc_target_outstanding */
      select outstanding_amount as "o" from invoices where id = ${invId}::uuid
    `) as Row[];
    targets.push({
      invoiceId: invId,
      requested: Number(alloc.allocatedAmount),
      outstanding: Number(inv?.o ?? 0),
    });
  }
  const { capped, excess } = capAndSpillExplicit(targets);
  // Amounts are pre-computed (capAndSpillExplicit is pure), so all writes are
  // independent — batch them into ONE round-trip instead of 1-2 per target.
  const explicitStmts = [];
  for (const c of capped) {
    if (c.applied > 0.005) explicitStmts.push(applyToInvoiceStmt(sql, c.invoiceId, c.applied));
    if (c.row === "shrink") {
      explicitStmts.push(sql`
        /* cap_explicit_allocation */
        update collection_allocations set allocated_amount = ${c.applied}
        where collection_id = ${collectionId}::uuid and invoice_id = ${c.invoiceId}::uuid
      `);
    } else if (c.row === "delete") {
      // Target already settled — drop the (uncapped) placeholder allocation.
      explicitStmts.push(sql`
        /* drop_unfittable_explicit_allocation */
        delete from collection_allocations
        where collection_id = ${collectionId}::uuid and invoice_id = ${c.invoiceId}::uuid
      `);
    }
  }
  if (explicitStmts.length > 0) await sql.transaction(explicitStmts);
  return excess;
}

/** Auto-allocate `toAllocate` oldest-first: the customer's OPENING BALANCE (if
 *  any) is the oldest debt and is cleared before invoices oldest-due-first. */
async function applyOldestFirstAllocations(
  sql: SqlClient,
  context: CollectionContext,
  collectionId: string,
  customerId: string,
  toAllocate: number,
): Promise<void> {
  const opening = await getOpeningTarget(sql, customerId);
  const invoiceRows = await sql`
    /* list_outstanding_invoices_for_reconcile */
    select id, outstanding_amount as "outstandingAmount",
           due_date as "dueDate", created_at as "createdAt"
    from invoices
    where customer_id = ${customerId}::uuid
      and outstanding_amount > 0
  `;
  // Null due dates sort LAST (Postgres `order by due_date` nulls-last default).
  const invoices: InvoiceTarget[] = invoiceRows.map((r) => ({
    id: str(r.id),
    outstanding: Number(r.outstandingAmount),
    dueDate: r.dueDate ? str(r.dueDate).slice(0, 10) : "9999-12-31",
    createdAt: str(r.createdAt),
  }));

  const { allocations } = allocateOldestFirst(toAllocate, opening, invoices);
  // Amounts are pre-computed by allocateOldestFirst, so the per-invoice writes are
  // independent — batch them into ONE round-trip (was 2 per allocation, an N+1;
  // audit G-0403). The opening balance is at most one per customer, so it stays on
  // the simple awaited path.
  const invoiceStmts = [];
  for (const a of allocations) {
    if (a.kind === "opening") {
      await sql`
        /* create_opening_allocation */
        insert into collection_allocations (collection_id, opening_balance_id, allocated_amount, allocated_by)
        values (${collectionId}::uuid, ${a.id}::uuid, ${a.amount}, ${context.userId}::uuid)
      `;
      await applyAllocationToOpening(sql, a.id, a.amount);
    } else {
      invoiceStmts.push(sql`
        /* create_collection_allocation */
        insert into collection_allocations (collection_id, invoice_id, allocated_amount, allocated_by)
        values (${collectionId}::uuid, ${a.id}::uuid, ${a.amount}, ${context.userId}::uuid)
      `);
      invoiceStmts.push(applyToInvoiceStmt(sql, a.id, a.amount));
    }
  }
  if (invoiceStmts.length > 0) await sql.transaction(invoiceStmts);
}

/**
 * Applies a verified collection to the customer's invoices. Explicit
 * allocations (chosen in the app) are applied as-is; a general payment is
 * auto-allocated oldest-due-first until the amount runs out.
 */
async function reconcileCollection(
  sql: SqlClient,
  context: CollectionContext,
  collectionId: string,
  customerId: string,
  collectionAmount: number,
): Promise<void> {
  const explicit = await sql`
    /* get_allocations_for_reconcile */
    select invoice_id as "invoiceId", allocated_amount as "allocatedAmount"
    from collection_allocations
    where collection_id = ${collectionId}::uuid
  `;

  // How much still needs auto-allocating oldest-first (below). For a general
  // payment that's the whole amount; for a collection created against a specific
  // invoice it's only the part that DIDN'T fit on the explicit target(s).
  let toAllocate = collectionAmount;

  if (explicit.length > 0) {
    const excess = await applyExplicitAllocations(sql, collectionId, explicit);
    if (excess <= 0.005) return;
    toAllocate = excess;
  }

  // General payment (or the spilled-over excess above): auto-allocate oldest-first.
  await applyOldestFirstAllocations(sql, context, collectionId, customerId, toAllocate);
}

/**
 * Re-apply ALL of a customer's verified collections from scratch, oldest-first
 * with the OPENING BALANCE included as the oldest debt. Needed when an opening
 * balance is created/edited: historical payments were reconciled against the
 * invoices before the opening existed (forward-only), so they must be replayed
 * so the genuinely-oldest debt (the opening) is cleared first. The customer's
 * TOTAL outstanding is unchanged — only how it's distributed across the opening
 * and the invoices. (One-shot admin action; heavy for customers with very many
 * collections — mind the Workers subrequest budget.)
 */
export async function reReconcileCustomer(
  sql: SqlClient,
  context: CollectionContext,
  customerId: string,
): Promise<void> {
  const verified = await sql`
    /* list_verified_collections_for_rereconcile */
    select id, collection_amount as "collectionAmount"
    from collections
    where customer_id = ${customerId}::uuid and accountant_approval_status = 'verified'
    order by collection_date, created_at
  `;
  // 1. Undo every existing allocation (restores invoice + opening outstanding).
  for (const c of verified) await reverseCollectionAllocations(sql, str(c.id));
  // 2. Hard-reset the opening balance to its full amount (no-op if none exists).
  await sql`
    /* reset_opening_for_rereconcile */
    update customer_opening_balances
    set amount_collected = 0, outstanding_amount = opening_amount, updated_at = now()
    where customer_id = ${customerId}::uuid
  `;
  // 3. Re-apply each collection oldest-first (opening first, then invoices).
  for (const c of verified) {
    await reconcileCollection(sql, context, str(c.id), customerId, Number(c.collectionAmount));
  }
  // 4. Any leftover held credit flows to still-open debts, oldest-first.
  await applyHeldCreditToOpenInvoices(sql, context, customerId);
}

export async function rejectCollection(
  sql: SqlClient,
  context: CollectionContext,
  id: string,
  remark: string,
) {
  const [existing] = await sql`
    /* get_collection_by_id */
    select id, accountant_approval_status as "status", collected_by_user_id as "collectedByUserId",
           customer_id as "customerId"
    from collections where id = ${id}::uuid
  `;
  if (!existing) throw new ApiError("NOT_FOUND", "Collection not found.", 404);
  if (existing.status !== "pending") {
    throw new ApiError("CONFLICT", `Collection is already ${existing.status}.`, 409);
  }

  await sql`
    /* reject_collection */
    update collections
    set
      accountant_approval_status = 'rejected',
      approved_by_accountant_id = ${context.userId}::uuid,
      approved_at = now(),
      remarks = ${remark},
      updated_at = now()
    where id = ${id}::uuid
  `;

  const seId = strOrNull(existing.collectedByUserId);
  if (seId) {
    await sql`
      /* create_rejection_alert */
      insert into alerts (
        alert_type,
        severity,
        executive_id,
        alert_message,
        recommended_action,
        status
      ) values (
        'COLLECTION_REJECTED',
        'medium',
        ${seId}::uuid,
        ${"Collection " + id + " was rejected: " + remark},
        'Review and re-submit the collection with correct details',
        'open'
      )
    `;
  }

  // Rejecting removes this money from the credit pool → recompute outstanding.
  await recomputeCustomerBalances(sql, str(existing.customerId));
  // Enriched detail (incl. the rejecting user's name) so the client can show it.
  return getCollectionById(sql, context, id);
}
