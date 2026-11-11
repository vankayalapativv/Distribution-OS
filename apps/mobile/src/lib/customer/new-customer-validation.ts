import { EMAIL_RE, type NewCustomerFields } from "./new-customer";

// Each group validates one cohesive set of fields so the top-level function
// stays flat (SonarQube S3776). All groups write disjoint error keys, so the
// merged result is identical to one big sequential block.

function contactErrors(v: NewCustomerFields): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.legalName.trim()) e.legalName = "Business name is required.";
  if (!v.phone) e.phone = "Phone number is required.";
  else if (v.phone.length !== 10) e.phone = "Enter a valid 10-digit phone number.";
  if (v.alternativePhone && v.alternativePhone.length !== 10)
    e.alternativePhone = "Enter a valid 10-digit phone number.";
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address.";
  return e;
}

function taxIdErrors(v: NewCustomerFields): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.gstNumber && v.gstNumber.length !== 15) e.gstNumber = "GST number must be exactly 15 characters.";
  if (v.panNumber && v.panNumber.length !== 10) e.panNumber = "PAN must be exactly 10 characters.";
  if (v.aadharNumber && v.aadharNumber.length !== 19)
    e.aadharNumber = "Udyam Aadhar must be 19 characters (UDYAM-XX-00-0000000).";
  return e;
}

function addressErrors(v: NewCustomerFields): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.addressStreet.trim()) e.addressStreet = "Street is required.";
  if (!v.addressCity.trim()) e.addressCity = "City is required.";
  if (!v.addressPincode.trim()) e.addressPincode = "Pincode is required.";
  return e;
}

function creditErrors(v: NewCustomerFields): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.creditLimit.trim()) e.creditLimit = "Credit limit is required.";
  else if (!(Number(v.creditLimit) >= 0)) e.creditLimit = "Enter a valid amount.";
  if (!v.creditDays.trim()) e.creditDays = "Credit days is required.";
  else if (!Number.isInteger(Number(v.creditDays)) || Number(v.creditDays) < 0)
    e.creditDays = "Enter a whole number of days.";
  return e;
}

/** Mandatory: business name, phone, address, credit terms (2026-07-12). */
export function computeCustomerErrors(
  v: NewCustomerFields,
  isSuperAdmin: boolean,
  photoCount: number,
  hasLocation: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {
    ...contactErrors(v),
    ...taxIdErrors(v),
    ...addressErrors(v),
    ...creditErrors(v),
  };
  if (isSuperAdmin && !v.salesExecutiveId)
    errors.salesExecutiveId = "Assign the customer to a sales executive.";
  if (!hasLocation) errors.geo = "Capture the shop location to continue.";
  if (!v.customerType) errors.customerType = "Select a customer type.";
  if (v.segments.length === 0) errors.segments = "Select at least one segment.";
  if (photoCount === 0) errors.photos = "Add at least one photo of the shop.";
  return errors;
}
