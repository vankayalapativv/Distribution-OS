// ── Delivery runs (logistics, online-first with an offline queue fallback) ────
import type { LocalDb } from "./local-db";
import { enqueue } from "./sync-core-types";

export interface DeliveryStartInput {
  clientUuid: string;
  vehicleNumber: string;
  startOdometer: number;
  runDate: string;
  /** Local uri of the mandatory start-odometer photo (uploaded best-effort). */
  startPhotoPath: string;
}

/**
 * Offline path: write the run locally (status 'active', photo not yet uploaded)
 * and enqueue the start. The sync-send handler POSTs it + uploads the photo and
 * maps the server id back onto this row once online.
 */
export function recordDeliveryStart(db: LocalDb, input: DeliveryStartInput, now: number): void {
  db.run(
    `insert into delivery_runs (client_uuid, vehicle_number, start_odometer, status, run_date, started_at, start_photo_path)
     values (?, ?, ?, 'active', ?, ?, ?)`,
    [input.clientUuid, input.vehicleNumber, input.startOdometer, input.runDate, now, input.startPhotoPath],
  );
  enqueue(db, "delivery_start", input.clientUuid, {
    vehicleNumber: input.vehicleNumber,
    startOdometer: input.startOdometer,
    clientUuid: input.clientUuid,
  }, now);
}

/**
 * Mirror a run that was ALREADY started on the server (see delivery-run-actions.ts).
 * Stores the run with its server id so subsequent stop
 * writes can target the run endpoint immediately, marks the start photo
 * uploaded. Best-effort: on a read-only DB the caller ignores the throw and
 * relies on a server-first refresh.
 */
export function mirrorStartedDeliveryRun(
  db: LocalDb,
  input: DeliveryStartInput & { serverId: string },
  now: number,
): void {
  db.run(
    `insert or replace into delivery_runs
       (client_uuid, server_id, vehicle_number, start_odometer, status, run_date, started_at, start_photo_path, start_photo_uploaded)
     values (?, ?, ?, ?, 'active', ?, ?, ?, 1)`,
    [
      input.clientUuid,
      input.serverId,
      input.vehicleNumber,
      input.startOdometer,
      input.runDate,
      now,
      input.startPhotoPath,
    ],
  );
}
