/**
 * Reverse-geocoding (device native geocoder, no API key) and the one-shot fix
 * used by visit check-in/out and photo stamping.
 */
import * as Location from "expo-location";
import { CHECK_IN_FIX_TIMEOUT_MS, withTimeout } from "./gps-config";

/**
 * The Android geocoder puts the *locality* (village/suburb) in `city` for Indian
 * addresses — the actual city/town is the formattedAddress element just before
 * the "State PIN" part (e.g. "…, Dhamsalapuram, Khammam, Telangana 507002,
 * India" → "Khammam").
 */
function cityFromFormattedAddress(
  formatted: string | null | undefined,
  state: string | null,
  pincode: string | null,
): string | null {
  if (!formatted) return null;
  const parts = formatted.split(",").map((p) => p.trim()).filter(Boolean);
  const stateIdx = parts.findIndex(
    (p) => (state && p.startsWith(state)) || (pincode && p.includes(pincode)),
  );
  return stateIdx > 0 ? parts[stateIdx - 1] : null;
}

/**
 * Reverse-geocode a fix into address parts. Fields may be null when the geocoder
 * has no data for the spot.
 */
export async function reverseGeocodeFix(
  latitude: number,
  longitude: number,
): Promise<{ city: string | null; state: string | null; pincode: string | null } | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!place) return null;
    const state = place.region ?? null;
    const pincode = place.postalCode ?? null;
    return {
      city:
        cityFromFormattedAddress(place.formattedAddress, state, pincode) ??
        place.city ??
        place.subregion ??
        null,
      state,
      pincode,
    };
  } catch {
    return null;
  }
}

/** One-shot fix for visit check-in / check-out and photo stamping. */
export async function getCheckInFix(): Promise<
  { latitude: number; longitude: number; accuracy: number | null; fresh: boolean } | null
> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return null;
  // A High-accuracy lock can stall for a long time indoors / inside a vehicle
  // even on good mobile signal (signal ≠ GPS fix). This runs on EVERY stamped
  // photo, so a stalled lock would freeze the capture button — cap the wait and
  // fall back to the last known fix rather than blocking.
  //
  // `fresh` tells the caller WHICH fix it got: the check-in / check-out geofence
  // requires a FRESH reading — a stale last-known fix (e.g. from where the SE was
  // an hour ago, which could sit inside the fence) must not silently pass the
  // fence. Photo-stamp callers don't care and keep using the fallback.
  const fresh = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null),
    CHECK_IN_FIX_TIMEOUT_MS,
    null,
  );
  const loc = fresh ?? (await Location.getLastKnownPositionAsync().catch(() => null));
  if (!loc) return null;
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    fresh: fresh != null,
  };
}
