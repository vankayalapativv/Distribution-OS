import { apiGet, type ActionConfig } from "@/lib/api-client";

/** The distributor's company / tax identity (Settings → Company). The single
 *  source of truth printed on reports, official documents, and receipts. */
export interface CompanyProfile {
  legalName: string;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  /** Contact line printed in the invoice header (Tel : … email : …). */
  phone: string;
  email: string;
  /** Payment-collection details printed on the generated invoice. */
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  upiId: string;
  /** Terms & Conditions block printed in the invoice footer. */
  termsAndConditions: string;
}

export const EMPTY_COMPANY: CompanyProfile = {
  legalName: "",
  gstin: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  upiId: "",
  termsAndConditions: "",
};

/** True when any bank/UPI payment detail is filled (so the invoice can decide
 *  whether to print a "Payment details" block). */
export function hasCompanyBankDetails(c: CompanyProfile): boolean {
  return Boolean(c.bankAccountName.trim() || c.bankAccountNumber.trim() || c.bankIfsc.trim() || c.upiId.trim());
}

/** Just the fields the letterhead helpers read — so callers that hold only a
 *  partial company (no bank/UPI) still typecheck. */
type CompanyAddress = Pick<CompanyProfile, "addressLine1" | "addressLine2" | "city" | "state" | "pincode" | "gstin">;

/** The postal-address lines (no name, no GSTIN), empties omitted:
 *  ["Door 5, MG Road", "Hyderabad, Telangana 500001"]. */
export function companyAddressLines(c: CompanyAddress): string[] {
  const lines: string[] = [];
  const street = [c.addressLine1, c.addressLine2].map((s) => s.trim()).filter(Boolean).join(", ");
  if (street) lines.push(street);
  const cityState = [c.city, c.state].map((s) => s.trim()).filter(Boolean).join(", ");
  const locality = [cityState, c.pincode.trim()].filter(Boolean).join(" ");
  if (locality) lines.push(locality);
  return lines;
}

/** The full letterhead block under the name — address lines + a GSTIN line,
 *  empties omitted. Used by the PDF header. */
export function companyLetterheadLines(c: CompanyAddress): string[] {
  const lines = companyAddressLines(c);
  if (c.gstin.trim()) lines.push(`GSTIN : ${c.gstin.trim()}`);
  return lines;
}

/** Load the company profile for client-side document generation (office roles).
 *  Returns EMPTY_COMPANY on any failure so a PDF still downloads (headerless). */
export async function fetchCompanyProfile(actionConfig: ActionConfig): Promise<CompanyProfile> {
  try {
    const res = await apiGet<{ company: CompanyProfile }>(actionConfig, "/system-settings/company");
    return { ...EMPTY_COMPANY, ...res.company };
  } catch {
    return EMPTY_COMPANY;
  }
}
