/** Delivery-run end writes: local close (offline) + server-mirror of a closed run. */
import type { LocalDb } from "./local-db";
import { enqueue } from "./sync-core-types";

export interface DeliveryEndInput {
  runClientUuid: string;
  endOdometer: number;
  /** Local uri of the mandatory end-odometer photo (uploaded best-effort). */
  endPhotoPath: string;
}

/**
 * Offline path: close the run locally (status 'ended', photo not yet uploaded)
 * and enqueue the end. The sync-send handler resolves the run's server id (FIFO),
 * POSTs the end + uploads the photo.
 */
export function recordDeliveryEnd(db: LocalDb, input: DeliveryEndInput, now: number): void {
  db.run(
    `update delivery_runs
     set status = 'ended', end_odometer = ?, ended_at = ?, end_photo_path = ?
     where client_uuid = ?`,
    [input.endOdometer, now, input.endPhotoPath, input.runClientUuid],
  );
  enqueue(db, "delivery_end", input.runClientUuid, {
    runClientUuid: input.runClientUuid,
    endOdometer: input.endOdometer,
  }, now);
}

/**
 * Mirror an end-run that was ALREADY saved on the server (see delivery-run-actions.ts)
 * so the local UI stops showing the run as active. Marks the end photo uploaded.
 * Best-effort for the caller: a read-only DB just leaves the stale "active" row
 * until the next server-first refresh.
 */
export function mirrorEndedDeliveryRun(
  db: LocalDb,
  input: Pick<DeliveryEndInput, "runClientUuid" | "endOdometer">,
  now: number,
): void {
  db.run(
    `update delivery_runs
     set status = 'ended', end_odometer = ?, ended_at = ?, end_photo_uploaded = 1
     where client_uuid = ?`,
    [input.endOdometer, now, input.runClientUuid],
  );
}
