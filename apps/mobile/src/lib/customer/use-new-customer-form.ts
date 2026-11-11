import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { useAuth } from "../auth";
import { getCheckInFix, reverseGeocodeFix } from "../gps";
import { EMPTY_CUSTOMER, type CreatedCustomer, type NewCustomerFields } from "./new-customer";
import { computeCustomerErrors } from "./new-customer-validation";
import { submitNewCustomer } from "./submit-new-customer";
import { usePhotoStaging } from "./use-photo-staging";

/** Field capture of a new customer (SE — active immediately, decided 2026-07-09). */
export function useNewCustomerForm() {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  // Super Admin creates on behalf of a field executive, so they must pick the
  // owner. A SALES_EXECUTIVE always owns their own captures (no picker shown).
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [v, setV] = useState<NewCustomerFields>(EMPTY_CUSTOMER);
  const set = <K extends keyof NewCustomerFields>(k: K) => (val: NewCustomerFields[K]) =>
    setV((p) => ({ ...p, [k]: val }));
  const [salesExecutiveName, setSalesExecutiveName] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const photo = usePhotoStaging(user?.name ?? "", v.legalName, setError);
  // Set once the customer record exists, so a retry after a failed photo
  // upload never creates a duplicate customer.
  const createdRef = useRef<CreatedCustomer | null>(null);
  // Stable idempotency key for this capture: if the create times out (15s) after
  // the server already committed, tapping Save again replays with the SAME key,
  // so the server returns the existing record (no duplicate / phone-409) and the
  // photo upload then proceeds. Generated lazily on first submit, kept across retries.
  const clientUuid = useRef<string | null>(null);

  function validate(): boolean {
    const errors = computeCustomerErrors(v, isSuperAdmin, photo.photos.length, geo != null);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Once errors are shown, clear each field's error as soon as the SE fixes it
  // (never surface NEW errors until the next Save press).
  useEffect(() => {
    setFieldErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const fresh = computeCustomerErrors(v, isSuperAdmin, photo.photos.length, geo != null);
      const next: Record<string, string> = {};
      for (const key of Object.keys(prev)) if (fresh[key]) next[key] = fresh[key];
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [v, isSuperAdmin, photo.photos.length, geo]);

  function onSelectSalesExec(id: string | null, name: string | null) {
    set("salesExecutiveId")(id);
    setSalesExecutiveName(name);
  }
  async function onCaptureLocation() {
    setGeoBusy(true);
    try {
      const fix = await getCheckInFix();
      if (!fix) return setError("Could not get a GPS fix — check location permission.");
      setGeo({ latitude: fix.latitude, longitude: fix.longitude });
      // Auto-fill City / State / Pincode from the fix — only empty fields,
      // never overwriting what the SE typed.
      const place = await reverseGeocodeFix(fix.latitude, fix.longitude);
      if (place)
        setV((p) => ({
          ...p,
          addressCity: place.city && !p.addressCity.trim() ? place.city : p.addressCity,
          addressState: place.state && !p.addressState.trim() ? place.state : p.addressState,
          addressPincode: place.pincode && !p.addressPincode.trim() ? place.pincode : p.addressPincode,
        }));
    } finally {
      setGeoBusy(false);
    }
  }

  async function onSubmit() {
    if (busy) return;
    if (!validate()) return setError("Please fill the required fields marked in red.");
    setBusy(true);
    setError(null);
    if (!clientUuid.current) clientUuid.current = Crypto.randomUUID();
    try {
      const customer = await submitNewCustomer({
        token, fields: v, isSuperAdmin, geo, createdRef, clientUuid: clientUuid.current, photos: photo.photos,
        setUploadingUri: photo.setUploadingUri, setPhotos: photo.setPhotos, setError,
      });
      if (customer)
        router.replace({ pathname: "/customer/[id]", params: { id: customer.id, name: customer.legalName } });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not create the customer. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return { v, set, isSuperAdmin, salesExecutiveName, onSelectSalesExec, fieldErrors, geo, geoBusy, onCaptureLocation, photo, busy, error, onSubmit };
}
