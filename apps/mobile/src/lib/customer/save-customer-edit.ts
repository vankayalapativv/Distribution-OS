import { toStoredPhone } from "../../components/phone-field";
import { apiFetch } from "../api";

interface SaveOpts {
  id: string;
  token: string | null;
  phone: string;
  segments: string[];
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  addressLandmark: string;
  geo: { latitude: number; longitude: number } | null;
}

/** Persists the SE-editable customer fields to the server (online-only). */
export async function saveCustomerEdit(o: SaveOpts): Promise<void> {
  await apiFetch(`/customers/${o.id}`, {
    method: "PATCH",
    token: o.token,
    body: {
      phone: toStoredPhone(o.phone),
      segment: o.segments.join(","),
      addressStreet: o.addressStreet.trim() || null,
      addressCity: o.addressCity.trim() || null,
      addressState: o.addressState.trim() || null,
      addressPincode: o.addressPincode.trim() || null,
      addressLandmark: o.addressLandmark.trim() || null,
      latitude: o.geo?.latitude ?? null,
      longitude: o.geo?.longitude ?? null,
    },
  });
}
