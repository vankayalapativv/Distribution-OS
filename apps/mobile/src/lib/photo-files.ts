/**
 * Copy just-picked photos out of the volatile ImagePicker cache into stable
 * files under the app's document directory, so they survive until the offline
 * sync queue uploads them (possibly hours later, long after the OS may have
 * cleared the picker cache).
 */
import { Directory, File, Paths } from "expo-file-system";
import type { PickedPhoto } from "./photo-picker";


function persistPhoto(dirName: string, fileBase: string, photo: PickedPhoto): string {
  const dir = new Directory(Paths.document, dirName);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const extByMime: Record<string, string> = { "image/png": "png", "image/webp": "webp" };
  const ext = extByMime[photo.type] ?? "jpg";
  const dest = new File(dir, `${fileBase}.${ext}`);
  if (dest.exists) dest.delete();
  new File(photo.uri).copySync(dest);
  return dest.uri;
}

/** Persist a collection proof photo, keyed by the collection's clientUuid. */
export function persistProofPhoto(clientUuid: string, photo: PickedPhoto): string {
  return persistPhoto("proofs", clientUuid, photo);
}

/**
 * Persist a delivery photo (odometer or per-stop proof) so it survives until
 * the delivery sync queue uploads it. `key` should be unique per photo, e.g.
 * `${runUuid}-start`, `${runUuid}-end`, `${stopUuid}-0`.
 */
export function persistDeliveryPhoto(key: string, photo: PickedPhoto): string {
  return persistPhoto("deliveries", key, photo);
}

/** Best-effort cleanup of a persisted photo once it has synced. */
export function deleteProofPhoto(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // already gone — nothing to do
  }
}
