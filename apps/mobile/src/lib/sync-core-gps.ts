// ── GPS pings ────────────────────────────────────────────────────────────────
import type { LocalDb, SqlValue } from "./local-db";

export interface GpsPingInput {
  locationPointId?: string;
  clientSessionId?: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  batteryPercentage: number | null;
  recordedAt: string;
  createdAt?: number;
}

function makeId(): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function insertGpsPing(db: LocalDb, ping: GpsPingInput): void {
  const locationPointId = ping.locationPointId ?? makeId();
  const createdAt = ping.createdAt ?? Date.now();
  db.run(
    `insert into gps_pings (
       location_point_id,
       client_session_id,
       latitude,
       longitude,
       accuracy,
       battery_percentage,
       recorded_at,
       created_at,
       sync_status
     )
     values (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      locationPointId,
      ping.clientSessionId ?? null,
      ping.latitude,
      ping.longitude,
      ping.accuracy,
      ping.batteryPercentage,
      ping.recordedAt,
      createdAt,
    ] as SqlValue[],
  );
}

export const GPS_BATCH_LIMIT = 500;
// A ping the server keeps asking us to 'retry' is parked to a terminal 'failed'
// after this many attempts — the 3-min flush cadence already spaces the tries,
// so the cap just stops a permanently-retried point looping forever.
export const MAX_GPS_RETRY_ATTEMPTS = 5;

export type GpsAckStatus = "accepted" | "duplicate" | "rejected" | "retry";

export interface GpsBatchAck {
  results: Array<{
    locationPointId: string;
    status: GpsAckStatus;
    reason?: string;
  }>;
}
