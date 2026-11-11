import { indianPhone, nullableFormValue, nullableNumberValue } from "@/lib/form";

/** Build the PATCH /customers/:id body from the edit form + controlled meta. */
export function buildEditPayload(fd: FormData, meta: { customerType: string; segments: string[] }) {
  return {
    legalName: nullableFormValue(fd, "legalName"),
    tradeName: nullableFormValue(fd, "tradeName"),
    customerName: nullableFormValue(fd, "customerName"),
    customerType: meta.customerType,
    segment: meta.segments.length > 0 ? meta.segments.join(",") : null,
    phone: indianPhone(fd, "phone"),
    alternativePhone: indianPhone(fd, "alternativePhone"),
    gstNumber: nullableFormValue(fd, "gstNumber"),
    panNumber: nullableFormValue(fd, "panNumber"),
    aadharNumber: nullableFormValue(fd, "aadharNumber"),
    addressStreet: nullableFormValue(fd, "addressStreet"),
    addressCity: nullableFormValue(fd, "addressCity"),
    addressState: nullableFormValue(fd, "addressState"),
    addressPincode: nullableFormValue(fd, "addressPincode"),
    addressLandmark: nullableFormValue(fd, "addressLandmark"),
    email: nullableFormValue(fd, "email"),
    creditLimit: nullableNumberValue(fd, "creditLimit"),
    creditDays: nullableNumberValue(fd, "creditDays"),
  };
}
