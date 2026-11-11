/** GPS queue heartbeat state and the tracking-heartbeat payload builder. */
import type { LocalDb } from "./local-db";

export interface GpsHeartbeatState {
  queuedPointCount: number;
  lastLocationAt: string | null;
}

export function getGpsHeartbeatState(db: LocalDb): GpsHeartbeatState {
  const queued = db.first<{ count: number }>(
    "select count(*) as count from gps_pings where synced = 0",
  );
  const last = db.first<{ recorded_at: string | null }>(
    "select recorded_at from gps_pings order by recorded_at desc limit 1",
  );
  return {
    queuedPointCount: queued?.count ?? 0,
    lastLocationAt: last?.recorded_at ?? null,
  };
}

export type PermissionState = "granted" | "denied" | "undetermined" | "unknown";

export interface TrackingHeartbeatDeviceState {
  deviceId: string | null;
  batteryPercentage?: number | null;
  isCharging?: boolean | null;
  isLowPowerModeEnabled?: boolean | null;
  isLocationEnabled: boolean | null;
  foregroundPermission: PermissionState;
  backgroundPermission: PermissionState;
  notificationPermission: PermissionState;
  batteryOptimizationStatus?: string | null;
  networkType: string | null;
  isConnected: boolean | null;
  appVersion: string | null;
  androidVersion: string | null;
  manufacturer: string | null;
  model: string | null;
}

export interface TrackingHeartbeatPayload {
  deviceId: string | null;
  capturedAt: string;
  batteryPercentage: number | null;
  isCharging: boolean | null;
  isLowPowerModeEnabled: boolean | null;
  isLocationEnabled: boolean | null;
  foregroundPermission: PermissionState;
  backgroundPermission: PermissionState;
  notificationPermission: PermissionState;
  batteryOptimizationStatus: string | null;
  networkType: string | null;
  isConnected: boolean | null;
  queuedPointCount: number;
  lastLocationAt: string | null;
  lastSuccessfulSyncAt: string | null;
  appVersion: string | null;
  androidVersion: string | null;
  manufacturer: string | null;
  model: string | null;
}

export function buildTrackingHeartbeat(input: {
  capturedAt: string;
  queue: GpsHeartbeatState;
  device: TrackingHeartbeatDeviceState;
  lastSuccessfulSyncAt: string | null;
}): TrackingHeartbeatPayload {
  return {
    deviceId: input.device.deviceId,
    capturedAt: input.capturedAt,
    batteryPercentage: input.device.batteryPercentage ?? null,
    isCharging: input.device.isCharging ?? null,
    isLowPowerModeEnabled: input.device.isLowPowerModeEnabled ?? null,
    isLocationEnabled: input.device.isLocationEnabled,
    foregroundPermission: input.device.foregroundPermission,
    backgroundPermission: input.device.backgroundPermission,
    notificationPermission: input.device.notificationPermission,
    batteryOptimizationStatus: input.device.batteryOptimizationStatus ?? null,
    networkType: input.device.networkType,
    isConnected: input.device.isConnected,
    queuedPointCount: input.queue.queuedPointCount,
    lastLocationAt: input.queue.lastLocationAt,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
    appVersion: input.device.appVersion,
    androidVersion: input.device.androidVersion,
    manufacturer: input.device.manufacturer,
    model: input.device.model,
  };
}
