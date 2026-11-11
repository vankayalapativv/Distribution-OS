import { NativeModules, Platform } from "react-native";

/**
 * Native bridge (NativeTrackingModule) for the two permissions that Android
 * exposes only as system screens, not runtime dialogs: battery-optimization
 * exemption and exact-alarm scheduling. Absent on iOS / non-native builds, so
 * every call degrades to a safe default (treats the permission as satisfied).
 */
type PermissionNativeModule = {
  isIgnoringBatteryOptimizations?: () => Promise<boolean>;
  requestIgnoreBatteryOptimizations?: () => Promise<boolean>;
  canScheduleExactAlarms?: () => Promise<boolean>;
  openExactAlarmSettings?: () => Promise<boolean>;
  openAutostartSettings?: () => Promise<boolean>;
};

function nativeModule(): PermissionNativeModule | null {
  if (Platform.OS !== "android") return null;
  return (NativeModules.NativeTracking as PermissionNativeModule | undefined) ?? null;
}

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  const native = nativeModule();
  if (!native?.isIgnoringBatteryOptimizations) return true;
  return native.isIgnoringBatteryOptimizations().catch(() => true);
}

export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  const native = nativeModule();
  if (!native?.requestIgnoreBatteryOptimizations) return;
  await native.requestIgnoreBatteryOptimizations().catch(() => undefined);
}

export async function canScheduleExactAlarms(): Promise<boolean> {
  const native = nativeModule();
  if (!native?.canScheduleExactAlarms) return true;
  return native.canScheduleExactAlarms().catch(() => true);
}

export async function openExactAlarmSettings(): Promise<void> {
  const native = nativeModule();
  if (!native?.openExactAlarmSettings) return;
  await native.openExactAlarmSettings().catch(() => undefined);
}

export async function openAutostartSettings(): Promise<void> {
  const native = nativeModule();
  if (!native?.openAutostartSettings) return;
  await native.openAutostartSettings().catch(() => undefined);
}
