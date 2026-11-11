/**
 * Transport primitives for photo uploads. `postPhotoUpload` arms a 60s abort
 * THROUGH the response read: expo/fetch has no timeout of its own, so without it
 * a stalled upload hangs the Save button forever.
 */
import { fetch as expoFetch } from "expo/fetch";

/** Photo location for the upload — coords always (when known), address when online. */
export interface PhotoGeo {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

const UPLOAD_TIMEOUT_MS = 60_000;

/** POST a multipart photo upload with a 60s abort + envelope check. Throws on
 *  failure or timeout; callers turn that into a user-facing error. */
export async function postPhotoUpload(
  url: string,
  headers: Record<string, string> | undefined,
  form: FormData,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const res = await expoFetch(url, { method: "POST", headers, body: form, signal: controller.signal });
    const payload = (await res.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
    } | null;
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.error?.message ?? `Photo upload failed (${res.status}).`);
    }
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error("Upload timed out — check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Append lat/lng/address so the server can store + back-fill them. */
export function appendGeo(form: FormData, geo: PhotoGeo | undefined): void {
  if (!geo) return;
  if (geo.latitude != null) form.append("latitude", String(geo.latitude));
  if (geo.longitude != null) form.append("longitude", String(geo.longitude));
  if (geo.address) form.append("address", geo.address);
}
