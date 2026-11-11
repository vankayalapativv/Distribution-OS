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
      bc.model as "billingModel", bc.unit_amount_paisa as "unitAmountPaisa", bc.flat_amount_paisa as "flatAmountPaisa"
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
  const godowns = await sql`select name, city, state, state_code as "stateCode" from stock_locations where enterprise_id = ${id} order by is_default desc, name`;
  const duesBands = await sql`select ordinal, from_days as "fromDays", to_days as "toDays", label from dues_bands where enterprise_id = ${id} order by ordinal`;
  const [series] = (await sql`select prefix, fin_year as "finYear", next_seq as "nextSeq" from invoice_series where enterprise_id = ${id} limit 1`) as Array<unknown>;
  const billing = (await sql`select model, unit_amount_paisa as "unitAmountPaisa", flat_amount_paisa as "flatAmountPaisa", gst_rate_bp as "gstRateBp" from enterprise_billing_config where enterprise_id = ${id} limit 1`)[0] ?? null;
  return { ...ent, settings, godowns, duesBands, invoiceSeries: series ?? null, billing };
}

interface ApproveInput {
  model: "per_seat" | "flat";
  amountPaisa: number;
  gstRateBp?: number;
}

/** Approve a pending enterprise: set its price and flip it to active (one step). */
export async function approveEnterprise(
  sql: SqlClient,
  ownerId: string,
  id: string,
  input: ApproveInput,
): Promise<{ status: "active" }> {
  if (input.model !== "per_seat" && input.model !== "flat")
    throw new ApiError("VALIDATION", "model must be per_seat or flat.", 422);
  if (!Number.isFinite(input.amountPaisa) || input.amountPaisa <= 0)
    throw new ApiError("VALIDATION", "A positive price (amountPaisa) is required.", 422);

  const [ent] = (await sql`select status from enterprises where id = ${id} limit 1`) as Array<{ status: string }>;
  if (!ent) throw new ApiError("NOT_FOUND", "Enterprise not found.", 404);
  if (ent.status === "active") throw new ApiError("CONFLICT", "Enterprise is already active.", 409);

  const unit = input.model === "per_seat" ? Math.trunc(input.amountPaisa) : null;
  const flat = input.model === "flat" ? Math.trunc(input.amountPaisa) : null;
  const gst = Number.isFinite(input.gstRateBp) ? Math.trunc(input.gstRateBp as number) : 1800;

  await sql.transaction([
    sql`
      insert into enterprise_billing_config
        (enterprise_id, model, unit_amount_paisa, flat_amount_paisa, gst_rate_bp, currency, updated_by, updated_at)
      values (${id}, ${input.model}, ${unit}, ${flat}, ${gst}, 'INR', ${ownerId}, now())
      on conflict (enterprise_id) do update
        set model = excluded.model, unit_amount_paisa = excluded.unit_amount_paisa,
            flat_amount_paisa = excluded.flat_amount_paisa, gst_rate_bp = excluded.gst_rate_bp,
            updated_by = excluded.updated_by, updated_at = now()
    `,
    sql`update enterprises set status = 'active', approved_by = ${ownerId}, approved_at = now(), rejected_reason = null, updated_at = now() where id = ${id}`,
  ]);
  return { status: "active" };
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
