import { router } from "expo-router";
import { useState } from "react";
import { toLocalPhone } from "../../components/phone-field";
import { useAuth } from "../auth";
import { getCheckInFix, reverseGeocodeFix } from "../gps";
import { saveCustomerEdit } from "./save-customer-edit";
import { useEditPhotos } from "./use-edit-photos";

export interface CustomerDetail {
  legalName: string;
  phone: string | null;
  segment: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPincode: string | null;
  addressLandmark: string | null;
}

/** State + handlers for the SE-restricted customer edit (address + GPS only). */
export function useEditCustomerForm(id: string, token: string | null, initial: CustomerDetail) {
  const user = useAuth((s) => s.user);
  const [phone, setPhone] = useState(toLocalPhone(initial.phone));
  const [segments, setSegments] = useState<string[]>(
    (initial.segment ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const [addressStreet, setAddressStreet] = useState(initial.addressStreet ?? "");
  const [addressLandmark, setAddressLandmark] = useState(initial.addressLandmark ?? "");
  const [addressCity, setAddressCity] = useState(initial.addressCity ?? "");
  const [addressState, setAddressState] = useState(initial.addressState ?? "");
  const [addressPincode, setAddressPincode] = useState(initial.addressPincode ?? "");
  const [geo, setGeo] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ street?: string; city?: string; pincode?: string }>({});
  const photos = useEditPhotos(id, token, user?.name ?? "", initial.legalName ?? null, setError);

  // Street / City / Pincode are mandatory on create — keep them mandatory here.
  function validate(): boolean {
    const errs: { street?: string; city?: string; pincode?: string } = {};
    if (!addressStreet.trim()) errs.street = "Street is required.";
    if (!addressCity.trim()) errs.city = "City is required.";
    if (!addressPincode.trim()) errs.pincode = "Pincode is required.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }
  const clearFieldError = (key: "street" | "city" | "pincode") =>
    setFieldErrors((f) => (f[key] ? { ...f, [key]: undefined } : f));

  async function onCaptureLocation() {
    setGeoBusy(true);
    try {
      const fix = await getCheckInFix();
      if (!fix) return setError("Could not get a GPS fix — check location permission.");
      setGeo({ latitude: fix.latitude, longitude: fix.longitude });
      // Re-capturing means the location changed: refresh City/State/Pincode
      // from the new fix (Street and Landmark stay manual).
      const place = await reverseGeocodeFix(fix.latitude, fix.longitude);
      if (place) {
        if (place.city) setAddressCity(place.city);
        if (place.state) setAddressState(place.state);
        if (place.pincode) setAddressPincode(place.pincode);
      }
    } finally {
      setGeoBusy(false);
    }
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    if (!validate()) return;
    // Phone is optional, but if present it must be a full 10-digit number
    // (matches the New Customer + profile rule).
    if (phone.length > 0 && phone.length !== 10)
      return setError("Enter a valid 10-digit phone number.");
    if (segments.length === 0) return setError("Select at least one segment.");
    setBusy(true);
    try {
      await saveCustomerEdit({
        id, token, phone, segments, addressStreet, addressCity, addressState, addressPincode, addressLandmark, geo,
      });
      setSaved(true);
      setTimeout(() => router.back(), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return {
    phone, setPhone, segments, setSegments, addressStreet, setAddressStreet, addressLandmark, setAddressLandmark,
    addressCity, setAddressCity, addressState, setAddressState, addressPincode, setAddressPincode,
    geo, geoBusy, busy, error, setError, saved, fieldErrors, clearFieldError, onCaptureLocation, onSave, photos, token,
  };
}
