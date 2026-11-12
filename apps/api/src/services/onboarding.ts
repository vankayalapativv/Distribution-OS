/**
 * Self-serve onboarding (Phase 3a). Runs on the OWNER (control-plane) client:
 * the signer-upper is authenticated (verified Neon identity) but has NO
 * enterprise until they submit, so the normal enterprise-scoped client can't be
 * used. We scope every query explicitly by the user's id here.
 *
 * Flow: Neon Auth sign-up → bootstrapAccount (users row, enterprise_id NULL) →
 * saveDraft (autosave the wizard) → submitOnboarding (create the pending
 * enterprise + all config + make the user its SUPER_ADMIN) → owner approval.
 */
import { ApiError } from "../lib/errors";
import { isUniqueViolation } from "../lib/pg-errors";
import { validateDuesBands } from "./dues";
import type { SqlClient } from "../lib/db";

export type OnboardingState = "no_account" | "draft" | "pending" | "active" | "rejected";

interface UserRow {
  id: string;
  enterpriseId: string | null;
}

async function findUser(sql: SqlClient, externalUserId: string): Promise<UserRow | null> {
  const [row] = (await sql`
    /* onboarding_find_user */
    select id, enterprise_id as "enterpriseId"
    from users
    where app_login_id = ${externalUserId}
    limit 1
  `) as UserRow[];
  return row ?? null;
}

/** The onboarding status for the current Neon identity. */
export async function getOnboardingState(
  sql: SqlClient,
  externalUserId: string,
): Promise<{ state: OnboardingState; userId: string | null; enterprise?: unknown; draft?: unknown }> {
  const user = await findUser(sql, externalUserId);
  if (!user) return { state: "no_account", userId: null };

  if (user.enterpriseId) {
    const [ent] = (await sql`
      /* onboarding_enterprise */
      select id, name, status, rejected_reason as "rejectedReason"
      from enterprises where id = ${user.enterpriseId} limit 1
    `) as Array<{ id: string; name: string; status: OnboardingState; rejectedReason: string | null }>;
    return { state: ent?.status ?? "pending", userId: user.id, enterprise: ent };
  }

  const [draft] = (await sql`
    /* onboarding_draft_peek */
    select payload, current_step as "currentStep"
    from onboarding_drafts where user_id = ${user.id} limit 1
  `) as Array<{ payload: unknown; currentStep: number }>;
  return { state: "draft", userId: user.id, draft: draft ?? null };
}

/**
 * Pre-signup uniqueness pre-check: is this email / phone already taken by any
 * user (across all enterprises)? email + phone are globally UNIQUE, so the signup
 * UI calls this BEFORE emailing an OTP — a duplicate is rejected up front instead
 * of after OTP (which would create a half-provisioned Neon account). Runs on the
 * owner client (pre-enterprise, no scope).
 */
export async function checkSignupAvailability(
  sql: SqlClient,
  input: { email: string; phone: string },
): Promise<{ emailTaken: boolean; phoneTaken: boolean }> {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const [row] = (await sql`
    /* onboarding_check_availability */
    select
      exists(select 1 from users where lower(email) = ${email}) as "emailTaken",
      exists(select 1 from users where phone = ${phone}) as "phoneTaken"
  `) as Array<{ emailTaken: boolean; phoneTaken: boolean }>;
  return { emailTaken: Boolean(row?.emailTaken), phoneTaken: Boolean(row?.phoneTaken) };
}

/** Create the app users row for a verified Neon identity (idempotent). */
export async function bootstrapAccount(
  sql: SqlClient,
  input: { externalUserId: string; email: string | null; name: string | null; phone?: string | null },
): Promise<{ userId: string }> {
  const existing = await findUser(sql, input.externalUserId);
  if (existing) return { userId: existing.id };
  // email + phone are globally UNIQUE across all enterprises (one person = one
  // login). A collision here means someone else already registered that email
  // or phone — surface a clear 409, not an opaque 500 (which would also be
  // logged as a server fault and fire an exception alert).
  try {
    const [row] = (await sql`
      /* onboarding_bootstrap_user */
      insert into users (enterprise_id, name, email, phone, app_login_id, status)
      values (null, ${input.name ?? "New user"}, ${input.email}, ${input.phone ?? null}, ${input.externalUserId}, 'active')
      returning id
    `) as Array<{ id: string }>;
    return { userId: row.id };
  } catch (err) {
    if (isUniqueViolation(err, "users_phone_key")) {
      throw new ApiError("PHONE_IN_USE", "This phone number is already registered.", 409);
    }
    if (isUniqueViolation(err, "users_email_key")) {
      throw new ApiError("EMAIL_IN_USE", "This email is already registered.", 409);
    }
    throw err;
  }
}

/** Resolve the app user id for a verified identity, or 409 if not bootstrapped. */
export async function requireOnboardingUser(sql: SqlClient, externalUserId: string): Promise<string> {
  const user = await findUser(sql, externalUserId);
  if (!user) throw new ApiError("NO_ACCOUNT", "Account not initialised. Call /onboarding/account first.", 409);
  return user.id;
}

export async function saveDraft(
  sql: SqlClient,
  userId: string,
  payload: unknown,
  currentStep: number,
): Promise<void> {
  await sql`
    /* onboarding_save_draft */
    insert into onboarding_drafts (user_id, payload, current_step, updated_at)
    values (${userId}, ${JSON.stringify(payload)}::jsonb, ${currentStep}, now())
    on conflict (user_id) do update
      set payload = excluded.payload, current_step = excluded.current_step, updated_at = now()
  `;
}

export async function getDraft(sql: SqlClient, userId: string): Promise<unknown> {
  const [row] = (await sql`
    /* onboarding_get_draft */
    select payload, current_step as "currentStep"
    from onboarding_drafts where user_id = ${userId} limit 1
  `) as Array<{ payload: unknown; currentStep: number }>;
  return row ?? null;
}

// ── Submit ──────────────────────────────────────────────────────────────────

interface Godown {
  name: string;
  addressLine?: string | null;
  city?: string | null;
  state: string;
  stateCode: string;
  pincode?: string | null;
}
interface DuesBand {
  fromDays: number;
  toDays: number | null;
  label: string;
}
export interface OnboardingPayload {
  admin: { name: string; designation: string };
  company: { legalName: string; gstin: string; tradeName: string; contactPhone: string; contactEmail: string };
  address: { line1: string; line2?: string | null; city: string; state: string; pincode: string };
  bank: { bankName: string; accountName: string; accountNumber: string; ifsc: string; upiId: string };
  invoice: { prefix: string; finYear: string; startSeq: number; terms: string };
  godowns: Godown[];
  tracking: { seAutoStopHour: number; logisticsAutoStopHour: number };
  duesBands: DuesBand[];
}

function req(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError("VALIDATION", `Missing required field: ${field}.`, 422);
  }
  return value.trim();
}

/** Validate every mandatory field. GSTIN is the one optional field. */
export function validateOnboarding(p: OnboardingPayload): OnboardingPayload {
  if (!p || typeof p !== "object") throw new ApiError("VALIDATION", "Onboarding data is required.", 422);
  req(p.admin?.name, "admin.name");
  req(p.admin?.designation, "admin.designation");
  req(p.company?.legalName, "company.legalName");
  // GSTIN is optional — normalize to a trimmed string (empty when omitted). The
  // enterprises.gstin column is NOT NULL, so a blank value is stored as "".
  if (p.company) p.company.gstin = typeof p.company.gstin === "string" ? p.company.gstin.trim() : "";
  req(p.company?.tradeName, "company.tradeName");
  req(p.company?.contactPhone, "company.contactPhone");
  req(p.company?.contactEmail, "company.contactEmail");
  req(p.address?.line1, "address.line1");
  req(p.address?.city, "address.city");
  req(p.address?.state, "address.state");
  req(p.address?.pincode, "address.pincode");
  req(p.bank?.bankName, "bank.bankName");
  req(p.bank?.accountName, "bank.accountName");
  req(p.bank?.accountNumber, "bank.accountNumber");
  req(p.bank?.ifsc, "bank.ifsc");
  req(p.bank?.upiId, "bank.upiId");
  req(p.invoice?.prefix, "invoice.prefix");
  req(p.invoice?.finYear, "invoice.finYear");
  req(p.invoice?.terms, "invoice.terms");
  if (!Number.isFinite(p.invoice?.startSeq)) throw new ApiError("VALIDATION", "invoice.startSeq is required.", 422);
  if (!Array.isArray(p.godowns) || p.godowns.length < 1)
    throw new ApiError("VALIDATION", "At least one godown is required.", 422);
  p.godowns.forEach((g, i) => {
    req(g.name, `godowns[${i}].name`);
    req(g.state, `godowns[${i}].state`);
    req(g.stateCode, `godowns[${i}].stateCode`);
  });
  if (!Number.isFinite(p.tracking?.seAutoStopHour) || !Number.isFinite(p.tracking?.logisticsAutoStopHour))
    throw new ApiError("VALIDATION", "SE and Logistics auto-stop times are required.", 422);
  // Exactly 4 contiguous bands (0 → ∞), ranges + labels editable — same rule the
  // Settings → Collection Dues editor enforces.
  validateDuesBands(p.duesBands);
  return p;
}

/**
 * Create the pending enterprise + all its config + make the signer-upper its
 * first SUPER_ADMIN, atomically, on the owner client. The enterprise id is
 * generated here so every child write can go in one neon transaction (which
 * can't read a mid-batch result).
 */
export async function submitOnboarding(
  sql: SqlClient,
  userId: string,
  raw: OnboardingPayload,
): Promise<{ enterpriseId: string; status: "pending" }> {
  const p = validateOnboarding(raw);
  const entId = crypto.randomUUID();

  const settings: Array<[string, string]> = [
    ["company_legal_name", p.company.legalName],
    ["company_trade_name", p.company.tradeName],
    ["company_gstin", p.company.gstin],
    ["company_phone", p.company.contactPhone],
    ["company_email", p.company.contactEmail],
    ["company_city", p.address.city],
    ["company_state", p.address.state],
    ["company_pincode", p.address.pincode],
    ["admin_designation", p.admin.designation],
    ["company_bank_name", p.bank.bankName],
    ["company_bank_account_name", p.bank.accountName],
    ["company_bank_account_number", p.bank.accountNumber],
    ["company_bank_ifsc", p.bank.ifsc],
    ["company_upi_id", p.bank.upiId],
    ["company_terms", p.invoice.terms],
    ["tracking_se_autostop_hour", String(p.tracking.seAutoStopHour)],
    ["tracking_logistics_autostop_hour", String(p.tracking.logisticsAutoStopHour)],
  ];

  const stmts = [
    sql`
      insert into enterprises
        (id, name, legal_name, gstin, contact_name, contact_phone, contact_email,
         address_line1, address_line2, address_city, address_state, address_pincode, status, created_by)
      values
        (${entId}, ${p.company.tradeName}, ${p.company.legalName}, ${p.company.gstin},
         ${p.admin.name}, ${p.company.contactPhone}, ${p.company.contactEmail},
         ${p.address.line1}, ${p.address.line2 ?? null}, ${p.address.city}, ${p.address.state},
         ${p.address.pincode}, 'pending', ${userId})
    `,
    sql`update users set enterprise_id = ${entId}, updated_at = now() where id = ${userId}`,
    sql`
      insert into user_roles (enterprise_id, user_id, role_id, assigned_by)
      select ${entId}, ${userId}, r.id, ${userId} from roles r where r.code = 'SUPER_ADMIN'
    `,
    ...settings.map(
      ([key, value]) => sql`
        insert into system_settings (enterprise_id, key, value, updated_at)
        values (${entId}, ${key}, ${value}, now())
      `,
    ),
    ...p.godowns.map(
      (g, i) => sql`
        insert into stock_locations
          (enterprise_id, name, code, address_line, city, state, state_code, pincode, is_default, status, created_by)
        values (${entId}, ${g.name}, ${null}, ${g.addressLine ?? null}, ${g.city ?? null}, ${g.state},
                ${g.stateCode}, ${g.pincode ?? null}, ${i === 0}, 'active', ${userId})
      `,
    ),
    sql`
      insert into invoice_series (enterprise_id, prefix, fin_year, next_seq, pad_width, updated_at)
      values (${entId}, ${p.invoice.prefix}, ${p.invoice.finYear}, ${Math.trunc(p.invoice.startSeq)}, 5, now())
    `,
    ...p.duesBands.map(
      (b, i) => sql`
        insert into dues_bands (enterprise_id, ordinal, from_days, to_days, label)
        values (${entId}, ${i}, ${Math.trunc(b.fromDays)}, ${b.toDays == null ? null : Math.trunc(b.toDays)}, ${b.label})
      `,
    ),
    sql`delete from onboarding_drafts where user_id = ${userId}`,
  ];

  await sql.transaction(stmts);
  return { enterpriseId: entId, status: "pending" };
}
