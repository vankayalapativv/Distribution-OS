import { indianPhone, nullableFormValue, nullableNumberValue, stringFormValue } from "@/lib/form";

export interface CustomerFormMeta {
  customerType: string;
  segments: string[];
  salesExecutiveId: string;
}

/** Client-side guard before POST — returns an error string, or null when valid. */
export function validateCustomer({ segments, salesExecutiveId }: CustomerFormMeta): string | null {
  if (segments.length === 0) return "Select at least one segment.";
  if (!salesExecutiveId) return "Assign the customer to a sales executive.";
  return null;
}

/** Build the POST /customers body from the form fields + controlled meta. */
export function buildCustomerPayload(fd: FormData, meta: CustomerFormMeta) {
  return {
    salesExecutiveId: meta.salesExecutiveId,
    legalName: stringFormValue(fd, "legalName"),
    tradeName: nullableFormValue(fd, "tradeName"),
    customerName: nullableFormValue(fd, "customerName"),
    customerType: meta.customerType,
    segment: meta.segments.join(","),
    phone: indianPhone(fd, "phone"),
    alternativePhone: indianPhone(fd, "alternativePhone"),
    gstNumber: nullableFormValue(fd, "gstNumber"),
    panNumber: nullableFormValue(fd, "panNumber"),
    aadharNumber: nullableFormValue(fd, "aadharNumber"),
    addressStreet: nullableFormValue(fd, "addressStreet"),
    addressCity: nullableFormValue(fd, "addressCity"),
    addressState: nullableFormValue(fd, "addressState"),
    addressPincode: nullableFormValue(fd, "addressPincode"),
    email: nullableFormValue(fd, "email"),
    creditLimit: nullableNumberValue(fd, "creditLimit"),
    creditDays: nullableNumberValue(fd, "creditDays"),
  };
}
