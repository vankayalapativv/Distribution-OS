/**
 * Photo stamping — burns an address/date/time/name band into every SE & Logistics
 * photo (like "GPS Map Camera" apps), baked into pixels so it survives WhatsApp.
 *
 * Split by concern; this file drives the pipeline and re-exports the public API:
 *  - photo-stamp-band:     pure geocode / size / text-line helpers
 *  - photo-stamp-composer: the off-screen photo + band view captureRef snapshots
 *  - photo-stamp-host:     PhotoStampHost — the single-slot capture queue
 *
 * Flow per photo: GPS fix → reverse-geocode → off-screen composer → captureRef.
 * Any failure falls open (the ORIGINAL photo is returned) so a shot is never lost.
 * `PhotoStampHost` must be mounted once at the app root; `stampPhoto` drives it.
 */
import { getCheckInFix } from "./gps";
import { buildLines, imageSize, reverseGeocode, type StampContext } from "./photo-stamp-band";
import { enqueue } from "./photo-stamp-host";
import type { PickedPhoto } from "./photos";

export type { StampContext } from "./photo-stamp-band";
export { PhotoStampHost } from "./photo-stamp-host";

// Cap the stamped output width — bounds memory AND keeps stored files small
// (field photos are rarely zoomed; ~1080px stays readable for shop signage).
const MAX_WIDTH = 1080;
// Overall fail-open safety net: whatever stalls inside (GPS lock, geocode,
// composer), the capture button is released within this window with the original
// (unstamped) photo — a shot is never lost and the flow never freezes.
const STAMP_PIPELINE_TIMEOUT_MS = 16000;

/** Resolve `p`, but give up after `ms` and yield `fallback` — guarantees the
 *  stamp pipeline always settles even if an inner native call hangs. */
function withStampTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Stamp one picked photo. Returns a NEW PickedPhoto pointing at the stamped JPEG,
 * or the ORIGINAL photo unchanged if anything goes wrong (never blocks). Wrapped
 * in an overall fail-open timeout so a hung GPS lock / captureRef / <Image> load
 * can't freeze the caller's capture button.
 */
export function stampPhoto(photo: PickedPhoto, ctx: StampContext): Promise<PickedPhoto> {
  return withStampTimeout(stampPhotoInner(photo, ctx), STAMP_PIPELINE_TIMEOUT_MS, photo);
}

async function stampPhotoInner(photo: PickedPhoto, ctx: StampContext): Promise<PickedPhoto> {
  try {
    if (!enqueue) return photo; // host not mounted → fail open

    const { w, h } = await imageSize(photo.uri);
    if (!w || !h) return photo; // unknown size → can't composite safely

    const fix = await getCheckInFix();
    const address = fix ? await reverseGeocode(fix.latitude, fix.longitude) : null;
    const lines = buildLines(fix, address, ctx);

    const scale = Math.min(1, MAX_WIDTH / w);
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);

    // Geo travels on the photo so the upload can persist coords + address
    // (server back-fills the street address from coords for offline captures).
    const geo = { latitude: fix?.latitude ?? null, longitude: fix?.longitude ?? null, address };

    const stampedUri = await new Promise<string | null>((resolve) => {
      enqueue?.({ uri: photo.uri, width, height, lines, resolve });
    });
    if (!stampedUri) return { ...photo, ...geo };

    return { uri: stampedUri, name: photo.name, type: "image/jpeg", ...geo };
  } catch {
    return photo;
  }
}
