/** GPS ping batch flush: send queued points, honour the per-point ack. */
import type { LocalDb } from "./local-db";
import {
  GPS_BATCH_LIMIT,
  type GpsBatchAck,
  type GpsPingInput,
  MAX_GPS_RETRY_ATTEMPTS,
} from "./sync-core-gps";

export async function flushGpsPings(
  db: LocalDb,
  sendBatch: (points: Required<Pick<GpsPingInput, "locationPointId" | "latitude" | "longitude" | "accuracy" | "batteryPercentage" | "recordedAt"> & { clientSessionId: string | null; createdAt: number }>[]) => Promise<unknown>,
): Promise<{ sent: number }> {
  const rows = db.all<{
    id: number;
    location_point_id: string;
    client_session_id: string | null;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    battery_percentage: number | null;
    recorded_at: string;
    created_at: number;
    attempts: number;
  }>(
    `select id, location_point_id, client_session_id, latitude, longitude, accuracy, battery_percentage, recorded_at, created_at, attempts
     from gps_pings where synced = 0 and sync_status in ('pending', 'retry') order by id limit ?`,
    [GPS_BATCH_LIMIT],
  );

  if (rows.length === 0) return { sent: 0 };

  const points = rows.map((r) => ({
    locationPointId: r.location_point_id,
    clientSessionId: r.client_session_id,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracy: r.accuracy,
    batteryPercentage: r.battery_percentage,
    recordedAt: r.recorded_at,
    createdAt: r.created_at,
  }));

  let ack: unknown;
  try {
    ack = await sendBatch(points);
  } catch {
    return { sent: 0 }; // stay queued; next flush retries
  }

  if (!ack || typeof ack !== "object" || !Array.isArray((ack as GpsBatchAck).results)) {
    // Malformed ack: optimistically accept ONLY the exact points we just sent —
    // never an `id <= maxId` range, which would also sweep up out-of-batch rows
    // already marked 'rejected' (they're synced = 0 too) and resurrect them.
    const ids = rows.map((r) => r.location_point_id);
    db.run(
      `update gps_pings set synced = 1, sync_status = 'accepted' where location_point_id in (${ids.map(() => "?").join(",")})`,
      ids,
    );
    return { sent: rows.length };
  }

  const attemptsByLpid = new Map(rows.map((r) => [r.location_point_id, r.attempts]));
  let sent = 0;
  for (const result of (ack as GpsBatchAck).results) {
    if (result.status === "accepted" || result.status === "duplicate") {
      db.run(
        "update gps_pings set synced = 1, sync_status = ?, rejection_reason = null where location_point_id = ?",
        [result.status, result.locationPointId],
      );
      sent += 1;
    } else if (result.status === "rejected") {
      db.run(
        "update gps_pings set synced = 0, sync_status = 'rejected', rejection_reason = ? where location_point_id = ?",
        [result.reason ?? "REJECTED", result.locationPointId],
      );
    } else {
      // retry: count the attempt and PARK to a terminal 'failed' after the cap
      // so a persistently-retried point can't re-upload every flush forever.
      const nextAttempts = (attemptsByLpid.get(result.locationPointId) ?? 0) + 1;
      const parked = nextAttempts >= MAX_GPS_RETRY_ATTEMPTS;
      db.run(
        "update gps_pings set synced = 0, sync_status = ?, attempts = ?, rejection_reason = ? where location_point_id = ?",
        [parked ? "failed" : "retry", nextAttempts, result.reason ?? null, result.locationPointId],
      );
    }
  }
  return { sent };
}
