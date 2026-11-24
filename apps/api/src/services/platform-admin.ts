/**
 * Platform-owner cockpit backend (Phase 3b). The platform owner belongs to NO
 * enterprise — identity lives in `platform_owners` (keyed to their Neon sub).
 * Every query runs on the OWNER client (control-plane, bypasses enterprise RLS)
 * so the owner can read/approve across all enterprises.
 */
import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";

/** Resolve the platform-owner id for a verified Neon identity, or 403. */
export async function resolvePlatformOwner(sql: SqlClient, externalUserId: string): Promise<string> {
  const [row] = (await sql`
    /* platform_owner_resolve */
    select id from platform_owners where auth_user_id = ${externalUserId} limit 1
  `) as Array<{ id: string }>;
  if (!row) throw new ApiError("FORBIDDEN", "Platform-owner access required.", 403);
  return row.id;
}

export async function listEnterprises(
  sql: SqlClient,
  filter: { status?: string },
): Promise<unknown[]> {
  const status = filter.status ?? null;
  return sql`
    /* platform_list_enterprises */
    select
      e.id, e.name, e.legal_name as "legalName", e.gstin, e.status,
      e.contact_name as "contactName", e.contact_email as "contactEmail",
      e.created_at as "createdAt", e.approved_at as "approvedAt", e.rejected_reason as "rejectedReason",
      bc.model as "billingModel", bc.unit_amount_paisa as "unitAmountPaisa", bc.flat_amount_paisa as "flatAmountPaisa",
      coalesce(bc.billing_enforced, false) as "billingEnforced"
    from enterprises e
    left join enterprise_billing_config bc on bc.enterprise_id = e.id
    where (${status}::text is null or e.status = ${status})
    order by e.created_at desc
  `;
}

/** Full submitted config for one enterprise (the approval-queue drill-down). */
export async function getEnterpriseDetail(sql: SqlClient, id: string): Promise<unknown> {
  const [ent] = (await sql`
    /* platform_enterprise */
    select id, name, legal_name as "legalName", gstin, status,
           contact_name as "contactName", contact_phone as "contactPhone", contact_email as "contactEmail",
           address_line1 as "addressLine1", address_line2 as "addressLine2", address_city as "addressCity",
           address_state as "addressState", address_pincode as "addressPincode",
           created_at as "createdAt", approved_at as "approvedAt", rejected_reason as "rejectedReason"
    from enterprises where id = ${id} limit 1
  `) as Array<Record<string, unknown>>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  const settings = await sql`select key, value from system_settings where enterprise_id = ${id} order by key`;
  const godowns = await sql`select id, name, address_line as "addressLine", city, state, state_code as "stateCode", pincode, is_default as "isDefault" from stock_locations where enterprise_id = ${id} order by is_default desc, name`;
  const duesBands = await sql`select ordinal, from_days as "fromDays", to_days as "toDays", label from dues_bands where enterprise_id = ${id} order by ordinal`;
  const [series] = (await sql`select prefix, fin_year as "finYear", next_seq as "nextSeq" from invoice_series where enterprise_id = ${id} limit 1`) as Array<unknown>;
  const billing = (await sql`select model, unit_amount_paisa as "unitAmountPaisa", flat_amount_paisa as "flatAmountPaisa", gst_rate_bp as "gstRateBp", coalesce(billing_enforced, false) as "enforced", coalesce(free_forever, false) as "freeForever", to_char(free_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "freeUntil" from enterprise_billing_config where enterprise_id = ${id} limit 1`)[0] ?? null;
  return { ...ent, settings, godowns, duesBands, invoiceSeries: series ?? null, billing };
}

/** Default GST rate (basis points) when none is given: 18%. */
const DEFAULT_GST_BP = 1800;

/** GST-inclusive paisa from a taxable BASE: base × (1 + gst/10000), rounded.
 *  The cockpit takes the base (e.g. ₹999); storage/charges stay GST-inclusive. */
export function inclusiveFromBase(basePaisa: number, gstRateBp: number): number {
  return Math.round(Math.max(0, Math.trunc(basePaisa)) * (1 + gstRateBp / 10000));
}

/** Free-period choice from the cockpit. `freeMonths`: whole free months counting
 *  from the current month (0 = bill immediately, 1 = this month only, N = N months).
 *  `freeForever` overrides to open-ended free. */
export interface FreeInput {
  freeMonths?: number;
  freeForever?: boolean;
}

function normalizeFree(input: FreeInput): { months: number; forever: boolean } {
  const forever = input.freeForever === true;
  const months = forever ? 0 : Math.max(0, Math.trunc(Number(input.freeMonths ?? 0)) || 0);
  return { months, forever };
}

/**
 * Re-price the CURRENT (unpaid) month's charge to the enterprise's live config —
 * including the free-period rule — so a plan/free change in the cockpit applies
 * immediately instead of only next cycle (fixes the "plan change doesn't apply"
 * bug). Owner client (RLS bypassed), so `enterprise_id` is qualified explicitly.
 * A PAID month is never touched. If the current month should be free it becomes
 * `free`/0; otherwise `pending` at the new amount (any stale Razorpay order cleared).
 */
async function repriceCurrentCharge(sql: SqlClient, id: string): Promise<void> {
  await sql`
    /* platform_reprice_current */
    with cfg as (
      select model, coalesce(unit_amount_paisa,0) as unit, coalesce(flat_amount_paisa,0) as flat,
             free_until, free_forever
      from enterprise_billing_config where enterprise_id = ${id}
    ),
    s as (select count(*)::int as seats from users where status = 'active' and enterprise_id = ${id}),
    calc as (
      select date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date as mstart,
             (cfg.free_forever
              or (cfg.free_until is not null
                  and date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date
                      < (cfg.free_until at time zone 'Asia/Kolkata')::date)) as is_free,
             case when cfg.model = 'flat' then cfg.flat else cfg.unit * s.seats end as target,
             s.seats as seats
      from cfg, s
    )
    update billing_charges c
       set status = case when calc.is_free then 'free' else 'pending' end,
           amount_paisa = case when calc.is_free then 0 else calc.target end,
           seats = calc.seats,
           razorpay_order_id = case when calc.is_free then null
                                    when c.amount_paisa <> calc.target then null
                                    else c.razorpay_order_id end
      from calc
     where c.enterprise_id = ${id}
       and c.period_start = calc.mstart
       and c.status <> 'paid'
  `;
}

/** Upsert config (base→inclusive) + set the free period, on the owner client. Shared
 *  by approve and the edit paths. Returns the query object so it can be awaited or
 *  batched into `sql.transaction([...])`. `months`/`forever` from normalizeFree. */
function writeBillingConfig(
  sql: SqlClient,
  ownerId: string,
  id: string,
  p: { model: "per_seat" | "flat"; basePaisa: number; gstBp: number; months: number; forever: boolean },
) {
  const inclusive = inclusiveFromBase(p.basePaisa, p.gstBp);
  const unit = p.model === "per_seat" ? inclusive : null;
  const flat = p.model === "flat" ? inclusive : null;
  return sql`
    /* platform_write_billing_config */
    insert into enterprise_billing_config
      (enterprise_id, model, unit_amount_paisa, flat_amount_paisa, gst_rate_bp, currency,
       free_forever, free_until, updated_by, updated_at)
    values (${id}, ${p.model}, ${unit}, ${flat}, ${p.gstBp}, 'INR',
            ${p.forever},
            case when ${p.forever} or ${p.months} <= 0 then null
                 else (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)
                       + (${p.months} || ' months')::interval) at time zone 'Asia/Kolkata' end,
            ${ownerId}, now())
    on conflict (enterprise_id) do update
      set model = excluded.model, unit_amount_paisa = excluded.unit_amount_paisa,
          flat_amount_paisa = excluded.flat_amount_paisa, gst_rate_bp = excluded.gst_rate_bp,
          free_forever = excluded.free_forever, free_until = excluded.free_until,
          updated_by = excluded.updated_by, updated_at = now()
  `;
}

interface ApproveInput extends FreeInput {
  model: "per_seat" | "flat";
  /** Taxable BASE price in paisa (GST added on top at gstRateBp). */
  amountPaisa: number;
  gstRateBp?: number;
}

/** Approve a pending enterprise: set its price + free period and flip it active. */
export async function approveEnterprise(
  sql: SqlClient,
  ownerId: string,
  id: string,
  input: ApproveInput,
): Promise<{ status: "active" }> {
  if (input.model !== "per_seat" && input.model !== "flat")
    throw new ApiError("VALIDATION", "model must be per_seat or flat.", 422);
  if (!Number.isFinite(input.amountPaisa) || input.amountPaisa <= 0)
    throw new ApiError("VALIDATION", "A positive base price (amountPaisa) is required.", 422);

  const [ent] = (await sql`select status from enterprises where id = ${id} limit 1`) as Array<{ status: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  if (ent.status === "active") throw new ApiError("CONFLICT", "Enterprise is already active.", 409);

  const gst = Number.isFinite(input.gstRateBp) ? Math.trunc(input.gstRateBp as number) : DEFAULT_GST_BP;
  const { months, forever } = normalizeFree(input);

  await sql.transaction([
    writeBillingConfig(sql, ownerId, id, { model: input.model, basePaisa: input.amountPaisa, gstBp: gst, months, forever }),
    sql`update enterprises set status = 'active', approved_by = ${ownerId}, approved_at = now(), rejected_reason = null, updated_at = now() where id = ${id}`,
    // Seed the current month: free when the chosen free period covers it, else a
    // priced pending charge (bill-immediately). Without a seed the enterprise would
    // have no paid/free period and be blocked at once. Owner client → explicit ids.
    sql`
      insert into billing_charges (enterprise_id, period_start, period_end, seats, amount_paisa, status)
      select ${id},
             date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date,
             (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) + interval '1 month' - interval '1 day')::date,
             (select count(*)::int from users where status = 'active' and enterprise_id = ${id}),
             case when ${forever} or ${months} > 0 then 0
                  else ${inclusiveFromBase(input.amountPaisa, gst)}
                       * case when ${input.model} = 'per_seat'
                              then (select count(*)::int from users where status = 'active' and enterprise_id = ${id})
                              else 1 end end,
             case when ${forever} or ${months} > 0 then 'free' else 'pending' end
      on conflict (enterprise_id, period_start) do nothing
    `,
  ]);
  return { status: "active" };
}

interface PricingInput extends FreeInput {
  model: "per_seat" | "flat";
  /** Taxable BASE price in paisa. */
  amountPaisa: number;
  gstRateBp?: number;
}

/**
 * Change an ALREADY-ACTIVE enterprise's price + free period. Writes the config AND
 * re-prices the current unpaid month immediately (via repriceCurrentCharge) so the
 * change applies now, not next cycle. A paid month is never changed. `amountPaisa`
 * is the taxable BASE; `gstRateBp` optional (kept if omitted).
 */
export async function updateEnterprisePricing(
  sql: SqlClient,
  ownerId: string,
  id: string,
  input: PricingInput,
): Promise<{ model: "per_seat" | "flat"; unitAmountPaisa: number | null; flatAmountPaisa: number | null }> {
  if (input.model !== "per_seat" && input.model !== "flat")
    throw new ApiError("VALIDATION", "model must be per_seat or flat.", 422);
  if (!Number.isFinite(input.amountPaisa) || input.amountPaisa <= 0)
    throw new ApiError("VALIDATION", "A positive base price (amountPaisa) is required.", 422);

  const [cur] = (await sql`select status, gst_rate_bp as "gstRateBp", free_forever as "freeForever", free_until as "freeUntil"
    from enterprises e left join enterprise_billing_config bc on bc.enterprise_id = e.id
    where e.id = ${id} limit 1`) as Array<{ status: string; gstRateBp: number | null }>;
  if (!cur) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  if (cur.status !== "active")
    throw new ApiError("CONFLICT", "Only an active enterprise's price can be edited here.", 409);

  const gst = Number.isFinite(input.gstRateBp) ? Math.trunc(input.gstRateBp as number) : Number(cur.gstRateBp ?? DEFAULT_GST_BP);
  // Pricing edit keeps the existing free period unless the caller sends one.
  const free =
    input.freeForever !== undefined || input.freeMonths !== undefined
      ? normalizeFree(input)
      : { months: -1, forever: false }; // -1 sentinel = keep existing free settings

  if (free.months === -1 && !free.forever) {
    // Keep the existing free period: upsert price/gst only.
    const inclusive = inclusiveFromBase(input.amountPaisa, gst);
    const unit = input.model === "per_seat" ? inclusive : null;
    const flat = input.model === "flat" ? inclusive : null;
    await sql`
      /* platform_update_pricing_only */
      update enterprise_billing_config
         set model = ${input.model}, unit_amount_paisa = ${unit}, flat_amount_paisa = ${flat},
             gst_rate_bp = ${gst}, updated_by = ${ownerId}, updated_at = now()
       where enterprise_id = ${id}
    `;
  } else {
    await writeBillingConfig(sql, ownerId, id, { model: input.model, basePaisa: input.amountPaisa, gstBp: gst, months: free.months, forever: free.forever });
  }
  await repriceCurrentCharge(sql, id);

  const [row] = (await sql`
    select model, unit_amount_paisa as "unitAmountPaisa", flat_amount_paisa as "flatAmountPaisa"
    from enterprise_billing_config where enterprise_id = ${id} limit 1
  `) as Array<Record<string, unknown>>;
  return {
    model: row.model === "flat" ? "flat" : "per_seat",
    unitAmountPaisa: row.unitAmountPaisa == null ? null : Number(row.unitAmountPaisa),
    flatAmountPaisa: row.flatAmountPaisa == null ? null : Number(row.flatAmountPaisa),
  };
}

/** Set ONLY the free period for an active enterprise and re-price the current month. */
export async function updateEnterpriseFreePeriod(
  sql: SqlClient,
  ownerId: string,
  id: string,
  input: FreeInput,
): Promise<{ freeForever: boolean; freeUntil: string | null }> {
  const [ent] = (await sql`select status from enterprises where id = ${id} limit 1`) as Array<{ status: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  if (ent.status !== "active")
    throw new ApiError("CONFLICT", "Only an active enterprise's free period can be set here.", 409);

  const { months, forever } = normalizeFree(input);
  await sql`
    /* platform_set_free_period */
    update enterprise_billing_config
       set free_forever = ${forever},
           free_until = case when ${forever} or ${months} <= 0 then null
                             else (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)
                                   + (${months} || ' months')::interval) at time zone 'Asia/Kolkata' end,
           updated_by = ${ownerId}, updated_at = now()
     where enterprise_id = ${id}
  `;
  await repriceCurrentCharge(sql, id);
  const [row] = (await sql`
    select free_forever as "freeForever",
           to_char(free_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "freeUntil"
    from enterprise_billing_config where enterprise_id = ${id} limit 1
  `) as Array<{ freeForever: boolean; freeUntil: string | null }>;
  return { freeForever: Boolean(row?.freeForever), freeUntil: row?.freeUntil ?? null };
}

/**
 * Turn billing enforcement on/off for ONE active enterprise (the per-enterprise
 * opt-in). The global BILLING_ENFORCED is the master switch; this flag decides
 * whether this enterprise is actually gated. Writes `enterprise_billing_config`,
 * which an active enterprise always has.
 */
export async function setEnterpriseEnforcement(
  sql: SqlClient,
  _ownerId: string,
  id: string,
  enforced: boolean,
): Promise<{ enforced: boolean }> {
  const [ent] = (await sql`select status from enterprises where id = ${id} limit 1`) as Array<{ status: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  if (ent.status !== "active")
    throw new ApiError("CONFLICT", "Only an active enterprise's billing can be enforced.", 409);

  const [row] = (await sql`
    /* platform_set_enforcement */
    update enterprise_billing_config
       set billing_enforced = ${enforced}, updated_at = now()
     where enterprise_id = ${id}
    returning billing_enforced as "enforced"
  `) as Array<{ enforced: boolean }>;
  if (!row) throw new ApiError("NOT_FOUND", "This enterprise has no billing configuration.", 404);
  return { enforced: Boolean(row.enforced) };
}

/** Reject a pending enterprise with a reason; the applicant can edit + resubmit. */
export async function rejectEnterprise(
  sql: SqlClient,
  _ownerId: string,
  id: string,
  reason: string,
): Promise<{ status: "rejected" }> {
  if (!reason || reason.trim() === "") throw new ApiError("VALIDATION", "A rejection reason is required.", 422);
  const [ent] = (await sql`select status from enterprises where id = ${id} limit 1`) as Array<{ status: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  await sql`update enterprises set status = 'rejected', rejected_reason = ${reason.trim()}, updated_at = now() where id = ${id}`;
  return { status: "rejected" };
}

/**
 * Suspend an active enterprise (block all its users without deleting data) or
 * reactivate a suspended one. `suspended` is a first-class enterprise state handled
 * end-to-end (the web auth landing routes a suspended tenant to a clear "account
 * suspended" screen, never to `?error=not_registered`).
 */
export async function setEnterpriseStatus(
  sql: SqlClient,
  _ownerId: string,
  id: string,
  action: "suspend" | "reactivate",
): Promise<{ status: "suspended" | "active" }> {
  const [ent] = (await sql`select status from enterprises where id = ${id} limit 1`) as Array<{ status: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  if (action === "suspend") {
    if (ent.status !== "active")
      throw new ApiError("CONFLICT", "Only an active enterprise can be suspended.", 409);
    await sql`update enterprises set status = 'suspended', updated_at = now() where id = ${id}`;
    return { status: "suspended" };
  }
  if (ent.status !== "suspended")
    throw new ApiError("CONFLICT", "Only a suspended enterprise can be reactivated.", 409);
  await sql`update enterprises set status = 'active', updated_at = now() where id = ${id}`;
  return { status: "active" };
}

/** Editable enterprise profile (company details collected at onboarding). An
 *  omitted (undefined) field is left unchanged. */
export interface EnterpriseProfileInput {
  name?: string;
  legalName?: string;
  gstin?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressCity?: string;
  addressState?: string;
  addressPincode?: string;
}

const s = (v: string | undefined): string | null => (v === undefined ? null : v.trim());

/** Update an enterprise's company/profile details (owner client). Each field uses
 *  coalesce so only provided fields change. */
export async function updateEnterpriseProfile(
  sql: SqlClient,
  _ownerId: string,
  id: string,
  p: EnterpriseProfileInput,
): Promise<{ updated: true }> {
  const [ent] = (await sql`select id from enterprises where id = ${id} limit 1`) as Array<{ id: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  if (p.name !== undefined && s(p.name) === "")
    throw new ApiError("VALIDATION", "Name cannot be empty.", 422);
  await sql`
    /* platform_update_profile */
    update enterprises set
      name          = coalesce(${s(p.name)}, name),
      legal_name    = coalesce(${s(p.legalName)}, legal_name),
      gstin         = coalesce(${s(p.gstin)}, gstin),
      contact_name  = coalesce(${s(p.contactName)}, contact_name),
      contact_phone = coalesce(${s(p.contactPhone)}, contact_phone),
      contact_email = coalesce(${s(p.contactEmail)}, contact_email),
      address_line1 = coalesce(${s(p.addressLine1)}, address_line1),
      address_line2 = coalesce(${s(p.addressLine2)}, address_line2),
      address_city  = coalesce(${s(p.addressCity)}, address_city),
      address_state = coalesce(${s(p.addressState)}, address_state),
      address_pincode = coalesce(${s(p.addressPincode)}, address_pincode),
      updated_at    = now()
    where id = ${id}
  `;
  return { updated: true };
}

// The only system_settings keys the cockpit may write — banking, invoice terms,
// field-tracking hours, and the admin designation. Everything else (and the
// company_* mirror keys, whose source of truth is the enterprises row) is ignored.
const EDITABLE_SETTING_KEYS = new Set([
  "company_bank_name",
  "company_bank_account_name",
  "company_bank_account_number",
  "company_bank_ifsc",
  "company_upi_id",
  "company_terms",
  "tracking_se_autostop_hour",
  "tracking_logistics_autostop_hour",
  "admin_designation",
]);

/** Upsert a whitelisted set of `system_settings` for one enterprise (banking,
 *  invoice terms, tracking hours, admin designation). Unknown keys are dropped.
 *  One set-based upsert on the (enterprise_id, key) PK. */
export async function updateEnterpriseSettings(
  sql: SqlClient,
  _ownerId: string,
  id: string,
  settings: Record<string, unknown>,
): Promise<{ updated: true }> {
  const [ent] = (await sql`select id from enterprises where id = ${id} limit 1`) as Array<{ id: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  const keys: string[] = [];
  const vals: string[] = [];
  for (const [k, v] of Object.entries(settings ?? {})) {
    if (EDITABLE_SETTING_KEYS.has(k)) {
      keys.push(k);
      vals.push(String(v ?? "").trim());
    }
  }
  if (keys.length === 0) return { updated: true };
  await sql`
    /* platform_update_settings */
    insert into system_settings (enterprise_id, key, value, updated_at)
    select ${id}, k, v, now() from unnest(${keys}::text[], ${vals}::text[]) as t(k, v)
    on conflict (enterprise_id, key) do update set value = excluded.value, updated_at = now()
  `;
  return { updated: true };
}

/** Edit the invoice numbering series' PREFIX and FINANCIAL YEAR only — never the
 *  running `next_seq` (which would risk duplicate/gapped invoice numbers). */
export async function updateEnterpriseInvoiceSeries(
  sql: SqlClient,
  _ownerId: string,
  id: string,
  p: { prefix?: string; finYear?: string },
): Promise<{ updated: true }> {
  const prefix = (p.prefix ?? "").trim();
  const finYear = (p.finYear ?? "").trim();
  if (!prefix || !finYear) throw new ApiError("VALIDATION", "Prefix and financial year are required.", 422);
  const [ent] = (await sql`select id from enterprises where id = ${id} limit 1`) as Array<{ id: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  let rows: Array<{ id: string }>;
  try {
    rows = (await sql`
      /* platform_update_invoice_series */
      update invoice_series set prefix = ${prefix}, fin_year = ${finYear}, updated_at = now()
      where enterprise_id = ${id} returning id
    `) as Array<{ id: string }>;
  } catch {
    throw new ApiError("CONFLICT", "That invoice prefix + financial year is already in use.", 409);
  }
  if (rows.length === 0) throw new ApiError("NOT_FOUND", "This enterprise has no invoice series.", 404);
  return { updated: true };
}

/** One editable/new godown. `id` present ⇒ edit that row; absent ⇒ insert a new
 *  (non-default) godown. No deletes here. */
export interface GodownInput {
  id?: string;
  name?: string;
  addressLine?: string | null;
  city?: string | null;
  state?: string;
  stateCode?: string;
  pincode?: string | null;
}

/** Edit existing godowns (by id) and add new ones for an enterprise. New godowns
 *  are never the default (an enterprise keeps exactly one default). All writes run
 *  in one transaction. */
export async function upsertEnterpriseGodowns(
  sql: SqlClient,
  _ownerId: string,
  id: string,
  godowns: GodownInput[],
): Promise<{ updated: true }> {
  const [ent] = (await sql`select id from enterprises where id = ${id} limit 1`) as Array<{ id: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  if (!Array.isArray(godowns)) throw new ApiError("VALIDATION", "A godowns list is required.", 422);
  const stmts = godowns.map((g) => {
    const name = (g.name ?? "").trim();
    const state = (g.state ?? "").trim();
    const stateCode = (g.stateCode ?? "").trim();
    if (!name || !state || !stateCode)
      throw new ApiError("VALIDATION", "Each godown needs a name, state and state code.", 422);
    const addr = g.addressLine ? g.addressLine.trim() : null;
    const city = g.city ? g.city.trim() : null;
    const pin = g.pincode ? g.pincode.trim() : null;
    if (g.id) {
      return sql`
        /* platform_godown_update */
        update stock_locations set name = ${name}, address_line = ${addr}, city = ${city},
          state = ${state}, state_code = ${stateCode}, pincode = ${pin}, updated_at = now()
        where id = ${g.id} and enterprise_id = ${id}
      `;
    }
    return sql`
      /* platform_godown_insert */
      insert into stock_locations
        (enterprise_id, name, code, address_line, city, state, state_code, pincode, is_default, status, created_by)
      values (${id}, ${name}, ${null}, ${addr}, ${city}, ${state}, ${stateCode}, ${pin}, false, 'active', ${null})
    `;
  });
  if (stmts.length > 0) await sql.transaction(stmts);
  return { updated: true };
}

/** One dues band's editable fields (the 4-band set is fixed; only ranges/labels
 *  change). `toDays` null = the open-ended top band. */
export interface DuesBandInput {
  fromDays?: number;
  toDays?: number | null;
  label?: string;
}

/** Update the 4 collection-dues bands' day ranges + labels (the count stays 4).
 *  Bands are applied in array order to ordinals 0..3. */
export async function updateEnterpriseDuesBands(
  sql: SqlClient,
  _ownerId: string,
  id: string,
  bands: DuesBandInput[],
): Promise<{ updated: true }> {
  const [ent] = (await sql`select id from enterprises where id = ${id} limit 1`) as Array<{ id: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  if (!Array.isArray(bands) || bands.length !== 4)
    throw new ApiError("VALIDATION", "Exactly 4 dues bands are required.", 422);
  const stmts = bands.map((b, i) => {
    const label = (b.label ?? "").trim();
    if (!label) throw new ApiError("VALIDATION", "Each band needs a label.", 422);
    const from = Math.max(0, Math.trunc(Number(b.fromDays)) || 0);
    const to = b.toDays === null || b.toDays === undefined ? null : Math.trunc(Number(b.toDays));
    return sql`
      /* platform_dues_band_update */
      update dues_bands set from_days = ${from}, to_days = ${to}, label = ${label}
      where enterprise_id = ${id} and ordinal = ${i}
    `;
  });
  try {
    await sql.transaction(stmts);
  } catch {
    throw new ApiError("VALIDATION", "Invalid dues band ranges (they must stay in ascending, non-overlapping order).", 422);
  }
  return { updated: true };
}

/** An enterprise's subscription charges + payments, newest month first (history
 *  view for the cockpit). Owner client — enterprise_id qualified explicitly. */
export async function listEnterpriseCharges(sql: SqlClient, id: string): Promise<unknown[]> {
  return sql`
    /* platform_enterprise_charges */
    select id, period_start as "periodStart", period_end as "periodEnd", seats,
           amount_paisa as "amountPaisa", status,
           razorpay_order_id as "razorpayOrderId", razorpay_payment_id as "razorpayPaymentId",
           to_char(paid_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as "paidAt"
    from billing_charges where enterprise_id = ${id}
    order by period_start desc
  `;
}
