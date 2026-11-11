/**
 * Server-side reverse geocoding for photo stamping. The Google key lives in
 * Workers secrets (never in the APK): device → our API → Google.
 *
 * Always resolves to a string address or null — a null (no key / timeout /
 * error / no result) means the caller keeps coordinates only. Geocoding must
 * never block a photo, so this never throws.
 */
const DEFAULT_TIMEOUT_MS = 3000;

/** Where a photo was taken — coords (when known) + resolved street address. */
export interface PhotoGeo {
  latitude: number | null;
  longitude: number | null;
  geocodedAddress: string | null;
}

/**
 * Read latitude/longitude/address off a photo-upload form and, when the device
 * sent coordinates but no address (offline capture), reverse-geocode server-side
 * to back-fill the street address. Never throws — missing/invalid → nulls.
 */
export async function photoGeoFromForm(
  apiKey: string | undefined,
  form: FormData | null,
): Promise<PhotoGeo> {
  const num = (v: FormDataEntryValue | null | undefined): number | null => {
    const n = typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const latitude = num(form?.get("latitude"));
  const longitude = num(form?.get("longitude"));
  const provided = form?.get("address");
  let geocodedAddress =
    typeof provided === "string" && provided.trim() ? provided.trim() : null;
  if (!geocodedAddress && latitude != null && longitude != null) {
    geocodedAddress = await reverseGeocode(apiKey, latitude, longitude);
  }
  return { latitude, longitude, geocodedAddress };
}

/**
 * Reverse-geocode a fix to a street address. Tries Google first (best India
 * quality) when a key is configured, then falls back to OpenStreetMap Nominatim
 * (free, no key) when Google has no key / errors / returns no result. Returns
 * null only when BOTH fail — so a photo still gets an address even before the
 * Google key is set on the Worker. Never throws.
 */
export async function reverseGeocode(
  apiKey: string | undefined,
  lat: number,
  lng: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (apiKey) {
    const fromGoogle = await googleReverse(apiKey, lat, lng, timeoutMs);
    if (fromGoogle) return fromGoogle;
  }
  return nominatimReverse(lat, lng, timeoutMs);
}

/** Google Maps Geocoding API. Null on error / no result. */
async function googleReverse(
  apiKey: string,
  lat: number,
  lng: number,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}` +
      `&result_type=street_address|premise|subpremise|route|neighborhood|sublocality` +
      `&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      results?: { formatted_address?: string }[];
    };
    if (data.status === "OK" && data.results?.length) {
      return data.results[0].formatted_address ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * OpenStreetMap Nominatim reverse geocoder — free, no API key. Nominatim's usage
 * policy requires an identifying User-Agent and rate-limits to ~1 req/s, which
 * is fine for occasional photo stamping. Null on error / no result.
 */
async function nominatimReverse(
  lat: number,
  lng: number,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "SriAparajithaDMS/1.0 (support@vardhansystems.in)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    // Drop the trailing ", India" for a tidier stamp; keep the rest.
    const addr = (typeof data.display_name === "string" ? data.display_name : "")
      .replace(/,\s*India\s*$/i, "")
      .trim();
    return addr || null;
  } catch {
    return null;
  }
}
