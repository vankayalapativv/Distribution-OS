/**
 * Public customer account-statement (no-login share link).
 *
 * Two halves:
 *  - `ensureStatementToken` — office-only: lazily mint (once) and return the
 *    customer's permanent share token. Idempotent: coalesce keeps the first token
 *    forever (never rotated/revoked — by design).
 *  - `getPublicStatementByToken` — the UN-authenticated read behind
 *    GET /public/customer-statement/:token. The token is the ONLY gate, so this
 *    does its own customer lookup and never trusts a caller-supplied id.
 *
 * The statement reuses `getCustomerLedger` (which takes no userId/role — all
 * visibility scoping lives in the authenticated routes, never in the builder),
 * so a public path simply resolves token → customerId and builds the ledger.
 */
import type { SqlClient } from "../lib/db";
import { getCustomerLedger, type LedgerData } from "./customers-ledger";
import { getSystemSettings, type CompanyProfile } from "./system-settings";

/** A customer-visible statement sits on the token alone — no internal code. */
export interface PublicStatement {
  company: CompanyProfile;
  customer: { name: string; city: string | null };
  /** ISO instant the statement was generated ("As on …"). */
  asOf: string;
  /** Live total still outstanding across ALL invoices (not just the window), on
   *  the VERIFIED books — unverified collections are not yet applied. */
  totalOutstanding: number;
  /** Sum of the customer's collections still pending accountant verification.
   *  These already reduce the ledger's running balance but NOT `totalOutstanding`,
   *  so the statement reconciles `totalOutstanding − paymentsUnderVerification`
   *  (= the ledger closing balance). 0 when there are none. */
  paymentsUnderVerification: number;
  /** Outstanding split into the 4 dues buckets, aged from invoice date (IST). */
  ageing: { "0_30": number; "30_45": number; "45_60": number; "60_plus": number };
  /** Rolling last-6-months ledger with opening balance brought forward. */
  ledger: LedgerData;
}

type Row = Record<string, unknown>;

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

/**
 * Mint-once / return the customer's permanent statement token. One set-based
 * UPDATE: coalesce preserves an existing token, otherwise gen_random_uuid()
 * assigns a fresh one. Returns null if the customer id doesn't exist.
 */
export async function ensureStatementToken(
  sql: SqlClient,
  customerId: string,
): Promise<string | null> {
  const rows = (await sql`
    /* ensure_statement_token */
    update customers
    set statement_token = coalesce(statement_token, gen_random_uuid())
    where id = ${customerId}::uuid
    returning statement_token as "token"
  `) as Row[];
  const token = rows[0]?.token;
  return token ? str(token) : null;
}

/**
 * Build the public statement for a share token, or null when the token matches
 * no customer. Caller (public route) is responsible for the uuid-shape guard.
 */
export async function getPublicStatementByToken(
  sql: SqlClient,
  token: string,
): Promise<PublicStatement | null> {
  const customerRows = (await sql`
    /* statement_customer_by_token */
    select id, legal_name as "legalName", trade_name as "tradeName", address_city as "city"
    from customers
    where statement_token = ${token}::uuid
    limit 1
  `) as Row[];
  const customer = customerRows[0];
  if (!customer) return null;
  const customerId = str(customer.id);

  // Rolling last 6 months (IST); opening balance before that is brought forward
  // by the ledger builder itself.
  const [range] = (await sql`
    /* statement_from_date */
    select to_char(
      ((now() at time zone 'Asia/Kolkata')::date - interval '6 months'),
      'YYYY-MM-DD'
    ) as "from"
  `) as Row[];
  const from = str(range.from);

  // Live ageing of ALL still-outstanding invoices + carried opening balance,
  // aged from the invoice/opening date in IST. Money summed in SQL numeric
  // (never JS float). Mirrors the dues buckets: 0–30 / 31–45 / 46–60 / 61+.
  const [ageRow] = (await sql`
    /* statement_ageing */
    with outstanding as (
      select outstanding_amount as amount, invoice_date as dated
      from invoices
      where customer_id = ${customerId}::uuid and outstanding_amount > 0
      union all
      select outstanding_amount as amount, as_of_date as dated
      from customer_opening_balances
      where customer_id = ${customerId}::uuid and outstanding_amount > 0
    ),
    aged as (
      select amount, ((now() at time zone 'Asia/Kolkata')::date - dated) as age_days
      from outstanding
    )
    select
      coalesce(sum(amount) filter (where age_days <= 30), 0)::float8 as "b0_30",
      coalesce(sum(amount) filter (where age_days > 30 and age_days <= 45), 0)::float8 as "b30_45",
      coalesce(sum(amount) filter (where age_days > 45 and age_days <= 60), 0)::float8 as "b45_60",
      coalesce(sum(amount) filter (where age_days > 60), 0)::float8 as "b60_plus",
      coalesce(sum(amount), 0)::float8 as "total"
    from aged
  `) as Row[];

  // Payments the customer has made that are still awaiting accountant
  // verification. The ledger already credits these (reducing its running
  // balance), but they are NOT yet applied to invoice outstanding, so this is
  // exactly the gap between `totalOutstanding` and the ledger closing balance.
  // Dated up to today IST, matching the ledger's own date ceiling.
  const [pendingRow] = (await sql`
    /* statement_pending_verification */
    select coalesce(sum(collection_amount), 0)::float8 as "pending"
    from collections
    where customer_id = ${customerId}::uuid
      and accountant_approval_status = 'pending'
      and collection_date <= (now() at time zone 'Asia/Kolkata')::date
  `) as Row[];

  const [ledger, settings] = await Promise.all([
    getCustomerLedger(sql, customerId, from, null),
    getSystemSettings(sql),
  ]);

  return {
    company: settings.company,
    customer: {
      name: str(customer.tradeName).trim() || str(customer.legalName),
      city: customer.city ? str(customer.city) : null,
    },
    asOf: new Date().toISOString(),
    totalOutstanding: num(ageRow.total),
    paymentsUnderVerification: num(pendingRow.pending),
    ageing: {
      "0_30": num(ageRow.b0_30),
      "30_45": num(ageRow.b30_45),
      "45_60": num(ageRow.b45_60),
      "60_plus": num(ageRow.b60_plus),
    },
    ledger,
  };
}
