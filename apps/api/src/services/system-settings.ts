import type { SqlClient } from "../lib/db";

export interface CompanyProfile {
  legalName: string;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  // Contact line printed in the invoice header (Tel : … email : …).
  phone: string;
  email: string;
  // Payment-collection details printed on the generated invoice (so the buyer
  // knows where to pay). All optional — blank when not yet filled.
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  upiId: string;
  // Terms & Conditions block printed in the invoice footer (editable).
  termsAndConditions: string;
  // The firm's Chartered Accountant — the default recipient for the GSTR-1
  // "email to CA" flow. Both optional (blank until configured).
  caName: string;
  caEmail: string;
}

/** The address/identity fields that must be present before a company profile is
 *  considered complete (enforced on save). GSTIN + legalName + line 2 are optional. */
export const REQUIRED_COMPANY_FIELDS: (keyof CompanyProfile)[] = [
  "addressLine1",
  "city",
  "state",
  "pincode",
];

export interface SystemSettings {
  company: CompanyProfile;
}

/** Keys backing the company profile (canonical org/tax identity). The old
 *  trade_name / pan / single-line address keys were retired 2026-10-16. */
const COMPANY_KEYS = {
  legalName: "company_legal_name",
  gstin: "company_gstin",
  addressLine1: "company_address_line1",
  addressLine2: "company_address_line2",
  city: "company_city",
  state: "company_state",
  pincode: "company_pincode",
  phone: "company_phone",
  email: "company_email",
  bankAccountName: "company_bank_account_name",
  bankAccountNumber: "company_bank_account_number",
  bankIfsc: "company_bank_ifsc",
  upiId: "company_upi_id",
  termsAndConditions: "company_terms",
  caName: "company_ca_name",
  caEmail: "company_ca_email",
} as const;

/** All key→value system settings as a map, with typed accessors layered on top. */
export async function getSystemSettings(sql: SqlClient): Promise<SystemSettings> {
  const rows = await sql`
    /* system_settings_list */
    select key, value from system_settings
  `;
  const map: Record<string, string> = {};
  for (const row of rows) map[String(row.key)] = String(row.value);
  return {
    company: {
      legalName: map[COMPANY_KEYS.legalName] ?? "",
      gstin: map[COMPANY_KEYS.gstin] ?? "",
      addressLine1: map[COMPANY_KEYS.addressLine1] ?? "",
      addressLine2: map[COMPANY_KEYS.addressLine2] ?? "",
      city: map[COMPANY_KEYS.city] ?? "",
      state: map[COMPANY_KEYS.state] ?? "",
      pincode: map[COMPANY_KEYS.pincode] ?? "",
      phone: map[COMPANY_KEYS.phone] ?? "",
      email: map[COMPANY_KEYS.email] ?? "",
      bankAccountName: map[COMPANY_KEYS.bankAccountName] ?? "",
      bankAccountNumber: map[COMPANY_KEYS.bankAccountNumber] ?? "",
      bankIfsc: map[COMPANY_KEYS.bankIfsc] ?? "",
      upiId: map[COMPANY_KEYS.upiId] ?? "",
      termsAndConditions: map[COMPANY_KEYS.termsAndConditions] ?? "",
      caName: map[COMPANY_KEYS.caName] ?? "",
      caEmail: map[COMPANY_KEYS.caEmail] ?? "",
    },
  };
}

/**
 * Upsert the company profile (canonical org/tax identity). Only the provided
 * fields are written, each as its own key/value row, in ONE set-based statement
 * (Workers subrequest cap — never one round-trip per field).
 */
export async function setCompanyProfile(
  sql: SqlClient,
  company: Partial<CompanyProfile>,
): Promise<void> {
  const pairs: Array<[string, string]> = [];
  if (company.legalName !== undefined) pairs.push([COMPANY_KEYS.legalName, company.legalName]);
  if (company.gstin !== undefined) pairs.push([COMPANY_KEYS.gstin, company.gstin]);
  if (company.addressLine1 !== undefined) pairs.push([COMPANY_KEYS.addressLine1, company.addressLine1]);
  if (company.addressLine2 !== undefined) pairs.push([COMPANY_KEYS.addressLine2, company.addressLine2]);
  if (company.city !== undefined) pairs.push([COMPANY_KEYS.city, company.city]);
  if (company.state !== undefined) pairs.push([COMPANY_KEYS.state, company.state]);
  if (company.pincode !== undefined) pairs.push([COMPANY_KEYS.pincode, company.pincode]);
  if (company.phone !== undefined) pairs.push([COMPANY_KEYS.phone, company.phone]);
  if (company.email !== undefined) pairs.push([COMPANY_KEYS.email, company.email]);
  if (company.bankAccountName !== undefined) pairs.push([COMPANY_KEYS.bankAccountName, company.bankAccountName]);
  if (company.bankAccountNumber !== undefined) pairs.push([COMPANY_KEYS.bankAccountNumber, company.bankAccountNumber]);
  if (company.bankIfsc !== undefined) pairs.push([COMPANY_KEYS.bankIfsc, company.bankIfsc]);
  if (company.upiId !== undefined) pairs.push([COMPANY_KEYS.upiId, company.upiId]);
  if (company.termsAndConditions !== undefined) pairs.push([COMPANY_KEYS.termsAndConditions, company.termsAndConditions]);
  if (company.caName !== undefined) pairs.push([COMPANY_KEYS.caName, company.caName]);
  if (company.caEmail !== undefined) pairs.push([COMPANY_KEYS.caEmail, company.caEmail]);
  if (pairs.length === 0) return;

  const keys = pairs.map((p) => p[0]);
  const values = pairs.map((p) => p[1]);
  await sql`
    /* upsert_company_profile */
    insert into system_settings (key, value)
    select * from unnest(${keys}::text[], ${values}::text[])
    on conflict (enterprise_id, key) do update set value = excluded.value, updated_at = now()
  `;
}
