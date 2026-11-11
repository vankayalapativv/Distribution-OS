/**
 * Delivery-stop sync unit: POST the stop against the run's server id (FIFO +
 * break-on-retryable guarantees the run synced first), then upload its proof
 * photos one at a time, dropping each from photo_paths after it uploads (the
 * delivery-photo endpoint isn't idempotent, so a retry must not re-send a
 * photo already accepted).
 */
import type { AddStopBody } from "./delivery-remote";
import { sendAddStop } from "./delivery-remote";
import type { LocalDb } from "./local-db";
import { deleteProofPhoto } from "./photo-files";
import { uploadDeliveryPhoto } from "./photo-upload";
import type { SyncQueueItem } from "./sync-core";

export async function sendDeliveryStop(
  item: SyncQueueItem,
  db: LocalDb,
  token: string | null,
): Promise<Record<string, unknown>> {
  const runUuid = typeof item.payload.runClientUuid === "string" ? item.payload.runClientUuid : "";
  const run = db.first<{ server_id: string | null }>(
    "select server_id from delivery_runs where client_uuid = ?",
    [runUuid],
  );
  if (!run?.server_id) throw new Error("Delivery run has not synced yet."); // retryable → defers

  const stop = await sendAddStop(run.server_id, item.payload as unknown as AddStopBody, token);

  const stopId = typeof stop.id === "string" ? stop.id : null;
  const row = db.first<{
    photo_paths: string;
    photos_uploaded: number;
    latitude: number | null;
    longitude: number | null;
  }>(
    "select photo_paths, photos_uploaded, latitude, longitude from delivery_stops where client_uuid = ?",
    [item.clientUuid],
  );
  if (stopId && row && row.photos_uploaded !== 1) {
    let paths: string[] = [];
    try {
      const parsed = JSON.parse(row.photo_paths) as unknown;
      if (Array.isArray(parsed)) paths = parsed.filter((p): p is string => typeof p === "string");
    } catch {
      paths = [];
    }
    const geo = { latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined };
    const remaining = [...paths];
    for (const path of paths) {
      await uploadDeliveryPhoto(run.server_id, path, "delivery", stopId, token, geo);
      remaining.shift();
      db.run("update delivery_stops set photo_paths = ? where client_uuid = ?", [
        JSON.stringify(remaining),
        item.clientUuid,
      ]);
      deleteProofPhoto(path);
    }
    db.run("update delivery_stops set photos_uploaded = 1 where client_uuid = ?", [item.clientUuid]);
  }
  return stop;
}
