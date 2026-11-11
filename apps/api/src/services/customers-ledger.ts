/**
 * Customer ledger — the running debit/credit statement assembled from opening
 * balance, invoices, collections and returns. Split from the customers god-file
 * (audit G-0104); shares foundation via ./customers-shared. Re-exported from
 * ./customers for callers.
 */
import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";
import {
  type CustomerContext,
  type Row,
  stringValue,
  nullableStringValue,
  numberValue,
  dateStringValue,
  nullableNumberValue,
  creatorScope,
  assertCustomerVisible,
} from "./customers-shared";

function toDateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return "";
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  cheque: "Cheque",
  card: "Card",
  bank_transfer: "Bank Transfer",
  google_pay: "Google Pay",
  phonepe: "PhonePe",
  neft: "NEFT",
  rtgs: "RTGS",
  credit_note: "Credit Note",
};

/** "upi" → "UPI", "google_pay" → "Google Pay"; blank → "Payment". */
function paymentModeLabel(mode: string): string {
  if (!mode) return "Payment";
  return (
    PAYMENT_MODE_LABELS[mode.toLowerCase()] ??
    mode.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
  );
}

export interface LedgerRow {
  date: string;
  type: "Sale" | "Rcpt" | "Sale_re";
  vchNo: string | null;
  particulars: string;
  narration: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  invoiceId?: string;
  collectionId?: string;
  /** Sale_re rows only: the sales_returns id (for the proof link). */
  returnId?: string;
  hasProof?: boolean;
  /** Rcpt rows only: true when the collection is still pending accountant verification. */
  needsVerify?: boolean;
  /**
   * Sale rows only: days from the invoice date until it was fully paid off
   * (FIFO — collections settle oldest invoices first). When the invoice is not
   * yet fully paid, this is the days outstanding so far and `paidOff` is false.
   */
  payoffDays?: number | null;
  paidOff?: boolean;
  /**
   * Sale rows only, when `paidOff` is false: true if this invoice caught a
   * PARTIAL payment under FIFO, false if it has received nothing yet (an older
   * invoice is still unpaid, so FIFO hasn't reached this one). Lets the ledger
   * show "Partially paid" only on the boundary invoice and "Unpaid" after it.
   */
  partiallyPaid?: boolean;
}

/** Whole days between two yyyy-mm-dd date strings (b − a), floored at 0. */
function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export async function getCustomerLedger(
  sql: SqlClient,
  customerId: string,
  fromInput: string | null,
  toInput: string | null,
) {
  type Row = Record<string, unknown>;

  // Effective range: default to the current IST month → today.
  const [range] = (await sql`
    /* ledger_range */
    select
      coalesce(${fromInput}::date, date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date) as "from",
      coalesce(${toInput}::date, (now() at time zone 'Asia/Kolkata')::date) as "to",
      (now() at time zone 'Asia/Kolkata')::date as "today"
  `) as Row[];
  const from = toDateStr(range.from);
  const to = toDateStr(range.to);
  const today = toDateStr(range.today);

  // Opening balance = sales (debit) − receipts (credit) − sales returns (credit)
  // strictly before `from`.
  const [ob] = (await sql`
    /* ledger_opening */
    select
      coalesce((select sum(invoice_net_value) from invoices
        where customer_id = ${customerId}::uuid and approval_status <> 'rejected' and doc_status <> 'cancelled'
          and invoice_date < ${from}::date), 0)::numeric
      - coalesce((select sum(collection_amount) from collections
        where customer_id = ${customerId}::uuid and accountant_approval_status is distinct from 'rejected'
          and collection_date < ${from}::date), 0)::numeric
      - coalesce((select sum(gross_amount) from sales_returns
        where customer_id = ${customerId}::uuid
          and return_date < ${from}::date), 0)::numeric as opening
  `) as Row[];
  const openingBalance = numberValue(ob.opening);

  const invoiceRows = (await sql`
    /* ledger_invoices */
    select i.id, i.invoice_number as "vchNo", i.invoice_date as "date", i.invoice_net_value as "amount",
      i.outstanding_amount as "outstanding", i.amount_collected as "amountCollected",
      greatest(
        coalesce((select max(c.collection_date) from collection_allocations ca
                  join collections c on c.id = ca.collection_id where ca.invoice_id = i.id), '0001-01-01'::date),
        coalesce((select max(sr.return_date) from sales_returns sr where sr.invoice_id = i.id), '0001-01-01'::date)
      ) as "settledDate"
    from invoices i
    where i.customer_id = ${customerId}::uuid and i.approval_status <> 'rejected' and i.doc_status <> 'cancelled'
      and i.invoice_date >= ${from}::date and i.invoice_date <= ${to}::date
  `) as Row[];

  const collectionRows = (await sql`
    /* ledger_collections */
    select c.id, c.collection_date as "date", c.payment_mode as "paymentMode", c.collection_amount as "amount",
      c.accountant_approval_status as "status",
      exists (select 1 from payment_proofs pp where pp.collection_id = c.id) as "hasProof"
    from collections c
    where c.customer_id = ${customerId}::uuid and c.accountant_approval_status is distinct from 'rejected'
      and c.collection_date >= ${from}::date and c.collection_date <= ${to}::date
  `) as Row[];

  const returnRows = (await sql`
    /* ledger_returns */
    select sr.id, sr.return_date as "date", sr.gross_amount as "amount",
      i.invoice_number as "vchNo", i.id as "invoiceId",
      (sr.proof_url is not null) as "hasProof"
    from sales_returns sr
    join invoices i on i.id = sr.invoice_id
    where sr.customer_id = ${customerId}::uuid
      and sr.return_date >= ${from}::date and sr.return_date <= ${to}::date
  `) as Row[];

  const [obRow] = (await sql`
    /* ledger_customer_opening */
    select ob.as_of_date as "asOfDate", ob.opening_amount as "amount",
      ob.amount_collected as "amountCollected", ob.outstanding_amount as "outstanding",
      (select max(c.collection_date) from collection_allocations ca
       join collections c on c.id = ca.collection_id where ca.opening_balance_id = ob.id) as "settledDate"
    from customer_opening_balances ob
    where ob.customer_id = ${customerId}::uuid
  `) as Row[];
  const opening = obRow
    ? {
        asOfDate: toDateStr(obRow.asOfDate),
        amount: numberValue(obRow.amount),
        collected: numberValue(obRow.amountCollected),
        outstanding: numberValue(obRow.outstanding),
        settledDate: obRow.settledDate ? toDateStr(obRow.settledDate) : null,
      }
    : null;

  return assembleLedger({
    from,
    to,
    today,
    openingBalance,
    invoiceRows,
    collectionRows,
    returnRows,
    opening,
  });
}

export interface LedgerData {
  from: string;
  to: string;
  openingBalance: number;
  rows: LedgerRow[];
  totals: { debit: number; credit: number; closingBalance: number };
}

interface LedgerInputs {
  from: string;
  to: string;
  today: string;
  openingBalance: number;
  invoiceRows: Record<string, unknown>[];
  collectionRows: Record<string, unknown>[];
  returnRows: Record<string, unknown>[];
  /**
   * Stored per-customer opening balance (pre-system carry-forward), if any.
   * `outstanding`/`collected`/`settledDate` drive its Paid-off status from the
   * real ledger — not a re-computed FIFO.
   */
  opening?: {
    asOfDate: string;
    amount: number;
    outstanding: number;
    collected: number;
    settledDate: string | null;
  } | null;
}

/** The stored opening balance (oldest debt) as a ledger start adjustment + an
 *  optional visible "Opening Balance" Dr row: folded into the running start when
 *  it predates the window, shown as a row when it falls inside it. */
function openingLedgerRows(
  opening: LedgerInputs["opening"],
  from: string,
  to: string,
  openingBalance: number,
): { openingStart: number; openingRows: (LedgerRow & { sortKey: number })[] } {
  let openingStart = openingBalance;
  const openingRows: (LedgerRow & { sortKey: number })[] = [];
  if (opening && opening.amount > 0) {
    if (opening.asOfDate < from) {
      openingStart += opening.amount;
    } else if (opening.asOfDate <= to) {
      openingRows.push({
        date: opening.asOfDate,
        type: "Sale",
        vchNo: null,
        particulars: "Cr",
        narration: "Opening Balance",
        debit: opening.amount,
        credit: null,
        balance: 0,
        sortKey: -1,
      });
    }
  }
  return { openingStart, openingRows };
}

/**
 * Mutates each Sale row with its paid-off status from the STORED ledger figures,
 * not a re-computed FIFO. `outstanding_amount` already reflects BOTH collections
 * (reconcile) AND sales returns, so it's the real "still owed"; `settledDate` is
 * when the last payment/return cleared it. Keeps the column consistent with the
 * actual allocations (e.g. a never-paid opening shows Unpaid while the invoices
 * its collections really cleared show Paid).
 */
function attachPayoffStatus(
  rows: LedgerRow[],
  invoiceRows: Record<string, unknown>[],
  opening: LedgerInputs["opening"],
  today: string,
): void {
  const EPS = 0.005;
  const applyPayoff = (
    row: LedgerRow,
    outstanding: number,
    collected: number,
    settledDate: string | null,
  ): void => {
    if (outstanding <= EPS) {
      row.paidOff = true;
      row.payoffDays = dayDiff(row.date, settledDate ?? today);
    } else {
      row.paidOff = false;
      row.partiallyPaid = collected > EPS; // caught some payment vs nothing yet
      row.payoffDays = dayDiff(row.date, today); // days outstanding so far
    }
  };

  const statusByInvoice = new Map<
    string,
    { outstanding: number; collected: number; settledDate: string | null }
  >();
  for (const r of invoiceRows) {
    statusByInvoice.set(stringValue(r.id), {
      outstanding: numberValue(r.outstanding),
      collected: numberValue(r.amountCollected),
      settledDate: r.settledDate ? toDateStr(r.settledDate) : null,
    });
  }

  for (const row of rows) {
    if (row.type !== "Sale") continue;
    if (row.invoiceId) {
      const s = statusByInvoice.get(row.invoiceId);
      if (s) applyPayoff(row, s.outstanding, s.collected, s.settledDate);
    } else if (opening) {
      // The visible Opening Balance row — from its own stored figures.
      applyPayoff(row, opening.outstanding, opening.collected, opening.settledDate);
    }
  }
}

/**
 * Pure ledger assembly: merge invoice/collection/return rows in the visible
 * range into a running Dr/Cr statement, then FIFO-attach per-invoice payoff over
 * the customer's FULL history. Shared by the single-customer path
 * (`getCustomerLedger`) and the bulk offline-prefetch path
 * (`getCustomerLedgersBulk`) so both produce byte-identical statements.
 */
function assembleLedger(input: LedgerInputs): LedgerData {
  type Row = Record<string, unknown>;
  const { from, to, today, openingBalance } = input;
  const invoiceRows = input.invoiceRows as Row[];
  const collectionRows = input.collectionRows as Row[];
  const returnRows = input.returnRows as Row[];

  // Stored opening balance (oldest debt): a running-start adjustment plus an
  // optional visible "Opening Balance" row when it falls inside the window.
  const opening = input.opening ?? null;
  const { openingStart, openingRows } = openingLedgerRows(opening, from, to, openingBalance);

  type Merged = LedgerRow & { sortKey: number };
  const merged: Merged[] = [
    ...openingRows,
    ...invoiceRows.map((r): Merged => ({
      date: toDateStr(r.date),
      type: "Sale",
      vchNo: stringValue(r.vchNo),
      particulars: "Cr",
      narration: "Sales",
      debit: numberValue(r.amount),
      credit: null,
      balance: 0,
      invoiceId: stringValue(r.id),
      sortKey: 0,
    })),
    ...collectionRows.map((r): Merged => ({
      date: toDateStr(r.date),
      type: "Rcpt",
      vchNo: null,
      particulars: "Dr",
      narration: paymentModeLabel(stringValue(r.paymentMode)),
      debit: null,
      credit: numberValue(r.amount),
      balance: 0,
      collectionId: stringValue(r.id),
      hasProof: r.hasProof === true,
      needsVerify: stringValue(r.status) === "pending",
      sortKey: 1,
    })),
    ...returnRows.map((r): Merged => ({
      date: toDateStr(r.date),
      type: "Sale_re",
      vchNo: stringValue(r.vchNo),
      particulars: "Dr",
      narration: "Sales_return",
      debit: null,
      credit: numberValue(r.amount),
      balance: 0,
      invoiceId: stringValue(r.invoiceId),
      returnId: stringValue(r.id),
      hasProof: r.hasProof === true,
      sortKey: 2,
    })),
  ].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return a.sortKey - b.sortKey;
  });

  let bal = openingStart;
  const rows: LedgerRow[] = merged.map(({ sortKey: _sortKey, ...r }) => {
    bal += (r.debit ?? 0) - (r.credit ?? 0);
    return { ...r, balance: bal };
  });

  attachPayoffStatus(rows, invoiceRows, opening, today);

  return {
    from,
    to,
    openingBalance: openingStart,
    rows,
    totals: {
      debit: rows.reduce((s, r) => s + (r.debit ?? 0), 0),
      credit: rows.reduce((s, r) => s + (r.credit ?? 0), 0),
      closingBalance: bal,
    },
  };
}

export interface CustomerLedgerEntry {
  customerId: string;
  ledger: LedgerData;
}

/**
 * Full (all-time) ledgers for EVERY customer visible to the caller, computed in a
 * handful of set-based queries (no per-customer round-trip). The mobile app calls
 * this once on sync to prefetch all ledgers so the ledger screen works fully
 * offline; the app slices the full statement to the chosen date range on-device.
 * SE scoping mirrors `assertCustomerVisible` (an SE sees only their customers).
 */
export async function getCustomerLedgersBulk(
  sql: SqlClient,
  context: CustomerContext,
  since: string | null = null,
): Promise<{ today: string; serverTime: string; ledgers: CustomerLedgerEntry[] }> {
  type Row = Record<string, unknown>;
  const scope = creatorScope(context);

  // `serverTime` is the server's own clock — the client stores it as the next
  // delta cursor, so no client/server clock skew can drop an update.
  const [range] = (await sql`
    /* bulk_ledger_now */
    select (now() at time zone 'Asia/Kolkata')::date as "today", now() as "serverTime"
  `) as Row[];
  const today = toDateStr(range.today);
  const serverTime =
    range.serverTime instanceof Date ? range.serverTime.toISOString() : String(range.serverTime);
  const FROM = "2000-01-01"; // full history; the opening balance is 0 before this

  // Which customers to (re)build: the full visible set on a cold pull; on a delta
  // pull (`since`), ONLY customers whose invoices/collections/returns changed after
  // the cursor. The full ledger is recomputed per changed customer, so removals
  // (e.g. a rejected collection) are handled correctly.
  const customerRows = (since
    ? await sql`
        /* bulk_ledger_changed_customers */
        select distinct cust.id from customers cust
        where (${scope}::uuid is null or cust.created_by = ${scope}::uuid)
          and (
            exists (select 1 from invoices i where i.customer_id = cust.id
                    and greatest(i.created_at, coalesce(i.updated_at, i.created_at)) > ${since}::timestamptz)
            or exists (select 1 from collections c where c.customer_id = cust.id
                    and greatest(c.created_at, coalesce(c.updated_at, c.created_at)) > ${since}::timestamptz)
            or exists (select 1 from sales_returns sr where sr.customer_id = cust.id
                    and sr.created_at > ${since}::timestamptz)
            or exists (select 1 from customer_opening_balances ob where ob.customer_id = cust.id
                    and greatest(ob.created_at, coalesce(ob.updated_at, ob.created_at)) > ${since}::timestamptz)
          )`
    : await sql`
        /* bulk_ledger_customers */
        select id from customers where (${scope}::uuid is null or created_by = ${scope}::uuid)`) as Row[];
  const customerIds = customerRows.map((r) => stringValue(r.id));
  if (customerIds.length === 0) return { today, serverTime, ledgers: [] };

  const invoiceRows = (await sql`
    /* bulk_ledger_invoices */
    select i.customer_id as "customerId", i.id, i.invoice_number as "vchNo",
           i.invoice_date as "date", i.invoice_net_value as "amount",
           i.outstanding_amount as "outstanding", i.amount_collected as "amountCollected",
           greatest(
             coalesce((select max(c.collection_date) from collection_allocations ca
                       join collections c on c.id = ca.collection_id where ca.invoice_id = i.id), '0001-01-01'::date),
             coalesce((select max(sr.return_date) from sales_returns sr where sr.invoice_id = i.id), '0001-01-01'::date)
           ) as "settledDate"
    from invoices i
    where i.approval_status <> 'rejected' and i.doc_status <> 'cancelled'
      and i.customer_id = any(${customerIds}::uuid[])
    order by i.customer_id, i.invoice_date, i.created_at
  `) as Row[];

  const collectionRows = (await sql`
    /* bulk_ledger_collections */
    select c.customer_id as "customerId", c.id, c.collection_date as "date",
           c.payment_mode as "paymentMode", c.collection_amount as "amount",
           c.accountant_approval_status as "status",
           exists (select 1 from payment_proofs pp where pp.collection_id = c.id) as "hasProof"
    from collections c
    where c.accountant_approval_status is distinct from 'rejected'
      and c.customer_id = any(${customerIds}::uuid[])
    order by c.customer_id, c.collection_date, c.created_at
  `) as Row[];

  const returnRows = (await sql`
    /* bulk_ledger_returns */
    select sr.customer_id as "customerId", sr.id, sr.return_date as "date", sr.gross_amount as "amount",
           i.invoice_number as "vchNo", i.id as "invoiceId",
           (sr.proof_url is not null) as "hasProof"
    from sales_returns sr
    join invoices i on i.id = sr.invoice_id
    where sr.customer_id = any(${customerIds}::uuid[])
    order by sr.customer_id, sr.return_date, sr.created_at
  `) as Row[];

  const byCustomer = (list: Row[]): Map<string, Row[]> => {
    const m = new Map<string, Row[]>();
    for (const r of list) {
      const cid = stringValue(r.customerId);
      const arr = m.get(cid);
      if (arr) arr.push(r);
      else m.set(cid, [r]);
    }
    return m;
  };
  const invByCust = byCustomer(invoiceRows);
  const colByCust = byCustomer(collectionRows);
  const retByCust = byCustomer(returnRows);

  // Stored opening balances for this batch, one lookup for all customers.
  const openingRows = (await sql`
    /* bulk_ledger_openings */
    select ob.customer_id as "customerId", ob.as_of_date as "asOfDate", ob.opening_amount as "amount",
           ob.amount_collected as "amountCollected", ob.outstanding_amount as "outstanding",
           (select max(c.collection_date) from collection_allocations ca
            join collections c on c.id = ca.collection_id where ca.opening_balance_id = ob.id) as "settledDate"
    from customer_opening_balances ob
    where ob.customer_id = any(${customerIds}::uuid[])
  `) as Row[];
  const openingByCust = new Map<
    string,
    { asOfDate: string; amount: number; outstanding: number; collected: number; settledDate: string | null }
  >();
  for (const r of openingRows) {
    openingByCust.set(stringValue(r.customerId), {
      asOfDate: toDateStr(r.asOfDate),
      amount: numberValue(r.amount),
      collected: numberValue(r.amountCollected),
      outstanding: numberValue(r.outstanding),
      settledDate: r.settledDate ? toDateStr(r.settledDate) : null,
    });
  }

  const ledgers: CustomerLedgerEntry[] = customerIds.map((customerId) => {
    const invoices = invByCust.get(customerId) ?? [];
    const collections = colByCust.get(customerId) ?? [];
    const returns = retByCust.get(customerId) ?? [];

    const ledger = assembleLedger({
      from: FROM,
      to: today,
      today,
      openingBalance: 0,
      invoiceRows: invoices,
      collectionRows: collections,
      returnRows: returns,
      opening: openingByCust.get(customerId) ?? null,
    });
    return { customerId, ledger };
  });

  return { today, serverTime, ledgers };
}
