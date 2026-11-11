import { apiFetch } from "../api";
import { uploadCustomerPhoto, type PickedPhoto } from "../photos";
import type { CreatedCustomer, NewCustomerFields } from "./new-customer";

type Geo = { latitude: number; longitude: number } | null;

function buildCustomerBody(v: NewCustomerFields, isSuperAdmin: boolean, geo: Geo, clientUuid: string) {
  return {
    clientUuid,
    legalName: v.legalName.trim(),
    tradeName: null,
    customerName: v.customerName.trim() || null,
    customerType: v.customerType,
    segment: v.segments.join(","),
    phone: v.phone ? `+91${v.phone}` : null,
    alternativePhone: v.alternativePhone ? `+91${v.alternativePhone}` : null,
    email: v.email.trim() || null,
    gstNumber: v.gstNumber.trim() || null,
    panNumber: v.panNumber.trim() || null,
    aadharNumber: v.aadharNumber.trim() || null,
    addressStreet: v.addressStreet.trim() || null,
    addressCity: v.addressCity.trim() || null,
    addressState: v.addressState.trim() || null,
    addressPincode: v.addressPincode.trim() || null,
    addressLandmark: v.addressLandmark.trim() || null,
    creditLimit: v.creditLimit ? Number(v.creditLimit) : null,
    creditDays: v.creditDays ? Number(v.creditDays) : null,
    // Owner assignment — only the Super Admin picks it; the server forces a
    // SALES_EXECUTIVE creator to self and ignores this field.
    salesExecutiveId: isSuperAdmin ? v.salesExecutiveId : null,
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
  };
}

interface SubmitOpts {
  token: string | null;
  fields: NewCustomerFields;
  isSuperAdmin: boolean;
  geo: Geo;
  createdRef: { current: CreatedCustomer | null };
  /** Idempotency key so a timed-out create can be safely replayed on retry. */
  clientUuid: string;
  photos: PickedPhoto[];
  setUploadingUri: (uri: string | null) => void;
  setPhotos: (photos: PickedPhoto[]) => void;
  setError: (message: string | null) => void;
}

/**
 * Creates the customer (once — guarded by `createdRef`) then uploads the staged
 * photos. Returns the customer when everything landed, or null when a photo
 * upload failed (the record is kept and the error is already surfaced).
 */
export async function submitNewCustomer(opts: SubmitOpts): Promise<CreatedCustomer | null> {
  const { token, fields, isSuperAdmin, geo, createdRef, clientUuid, photos, setUploadingUri, setPhotos, setError } = opts;
  const customer =
    createdRef.current ??
    (await apiFetch<CreatedCustomer>("/customers", {
      method: "POST",
      token,
      body: buildCustomerBody(fields, isSuperAdmin, geo, clientUuid),
    }));
  createdRef.current = customer;

  // The Customers directory is online-only (fetchSeCustomers) and refetches on
  // focus, so the new customer shows on return — no local cache write needed.

  // Upload photos after the record exists; on failure the customer is
  // kept and Save retries only the remaining photos.
  const queue = [...photos];
  while (queue.length > 0) {
    setUploadingUri(queue[0].uri);
    try {
      await uploadCustomerPhoto(customer.id, queue[0], token, "customer");
      queue.shift();
      setPhotos([...queue]);
    } catch {
      setUploadingUri(null);
      setError(
        "Customer saved, but a photo failed to upload. Check your connection and tap Save again to retry the remaining photos.",
      );
      return null;
    }
  }
  setUploadingUri(null);
  return customer;
}
