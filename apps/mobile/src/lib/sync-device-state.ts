/**
 * Device-state snapshot for the tracking heartbeat and the start-day health
 * checklist: gathers permissions, battery, network, and device metadata.
 */
import * as Network from "expo-network";
import Constants from "expo-constants";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { normalizeBatteryState } from "./tracking-heartbeat";
import { buildStartDayHealthChecklist, type StartDayHealthChecklist } from "./tracking-health";
import type { PermissionState, TrackingHeartbeatDeviceState } from "./sync-core";

function batteryStatus(enabled: boolean | null): "optimized" | "unrestricted" | null {
  if (enabled === null) return null;
  return enabled ? "optimized" : "unrestricted";
}

function permissionState(value: unknown): PermissionState {
  if (value && typeof value === "object" && "granted" in value && (value as { granted?: boolean }).granted) {
    return "granted";
  }
  if (value && typeof value === "object" && "status" in value) {
    const status = String((value as { status?: unknown }).status);
    if (status === "granted" || status === "denied" || status === "undetermined") return status;
  }
  return "unknown";
}

function networkType(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

export async function getTrackingHeartbeatDeviceState(): Promise<TrackingHeartbeatDeviceState> {
  const [fg, bg, notifications, locationEnabled, network, powerState, batteryOptimizationEnabled] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => null),
    Location.getBackgroundPermissionsAsync().catch(() => null),
    Notifications.getPermissionsAsync().catch(() => null),
    Location.hasServicesEnabledAsync().catch(() => null),
    Network.getNetworkStateAsync().catch(() => null),
    Battery.getPowerStateAsync().catch(() => null),
    Battery.isBatteryOptimizationEnabledAsync().catch(() => null),
  ]);
  const battery = normalizeBatteryState({
    batteryLevel: powerState?.batteryLevel ?? null,
    batteryState: powerState?.batteryState ?? null,
    lowPowerMode: powerState?.lowPowerMode ?? null,
  });

  return {
    deviceId: null,
    ...battery,
    isLocationEnabled: locationEnabled,
    foregroundPermission: permissionState(fg),
    backgroundPermission: permissionState(bg),
    notificationPermission: permissionState(notifications),
    batteryOptimizationStatus: batteryStatus(batteryOptimizationEnabled),
    networkType: networkType(network?.type),
    isConnected: network ? Boolean(network.isConnected) && network.isInternetReachable !== false : null,
    appVersion: Constants.expoConfig?.version ?? null,
    androidVersion: Device.osVersion ?? null,
    manufacturer: Device.manufacturer ?? null,
    model: Device.modelName ?? null,
  };
}

export async function getStartDayHealthChecklist(): Promise<StartDayHealthChecklist> {
  const device = await getTrackingHeartbeatDeviceState();
  return buildStartDayHealthChecklist({
    isLocationEnabled: device.isLocationEnabled,
    foregroundPermission: device.foregroundPermission,
    backgroundPermission: device.backgroundPermission,
    notificationPermission: device.notificationPermission,
    batteryOptimizationStatus: device.batteryOptimizationStatus ?? null,
    isConnected: device.isConnected,
  });
}
