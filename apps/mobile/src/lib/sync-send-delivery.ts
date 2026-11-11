/**
 * Delivery run start/end sync units: POST the run action (via the shared
 * delivery-remote senders, so endpoints match the online path), then upload the
 * odometer photo as part of the same unit. The start POST is idempotent by
 * clientUuid; the end resolves the run's server id (FIFO guarantees the start
 * synced first).
 */
import type { StartRunBody } from "./delivery-remote";
import { sendEndRun, sendStartRun } from "./delivery-remote";
import type { LocalDb } from "./local-db";
import { deleteProofPhoto } from "./photo-files";
import { uploadDeliveryPhoto } from "./photo-upload";
import type { SyncQueueItem } from "./sync-core";

export async function sendDeliveryStart(
  item: SyncQueueItem,
  db: LocalDb,
  token: string | null,
): Promise<Record<string, unknown>> {
  const run = await sendStartRun(item.payload as unknown as StartRunBody, token);

  const runId = typeof run.id === "string" ? run.id : null;
  const row = db.first<{ start_photo_path: string | null; start_photo_uploaded: number }>(
    "select start_photo_path, start_photo_uploaded from delivery_runs where client_uuid = ?",
    [item.clientUuid],
  );
  if (runId && row?.start_photo_path && row.start_photo_uploaded !== 1) {
    await uploadDeliveryPhoto(runId, row.start_photo_path, "start_odometer", null, token);
    db.run("update delivery_runs set start_photo_uploaded = 1 where client_uuid = ?", [item.clientUuid]);
    deleteProofPhoto(row.start_photo_path);
  }
  return run;
}

export async function sendDeliveryEnd(
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

  const endBody = {
    runClientUuid: runUuid,
    endOdometer: typeof item.payload.endOdometer === "number" ? item.payload.endOdometer : 0,
  };
  const ended = await sendEndRun(run.server_id, endBody, token);

  const rowEnd = db.first<{ end_photo_path: string | null; end_photo_uploaded: number }>(
    "select end_photo_path, end_photo_uploaded from delivery_runs where client_uuid = ?",
    [runUuid],
  );
  if (rowEnd?.end_photo_path && rowEnd.end_photo_uploaded !== 1) {
    await uploadDeliveryPhoto(run.server_id, rowEnd.end_photo_path, "end_odometer", null, token);
    db.run("update delivery_runs set end_photo_uploaded = 1 where client_uuid = ?", [runUuid]);
    deleteProofPhoto(rowEnd.end_photo_path);
  }
  return ended;
}
