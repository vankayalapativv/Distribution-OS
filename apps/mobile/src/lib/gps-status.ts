/**
 * Read-only tracking / permission status queries used by the tiles, the settings
 * screen, and the Start-day flow.
 */
import * as Location from "expo-location";
import { GPS_TASK, type LocationStatus } from "./gps-config";
import { getNativeTracking } from "./gps-native";
import { dayEndedToday, dayStartedToday } from "./gps-session";
import { getForegroundWatch } from "./gps-state";

/** True when "Allow all the time" (background) is already granted, so Start-day
 *  can skip the rationale and go straight to tracking. */
export async function hasBackgroundLocationPermission(): Promise<boolean> {
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  return Boolean(bg?.granted);
}

/**
 * Current location-permission state for the settings screen:
 * - `ready` → background granted (day tracking works in background)
 * - `foreground_only` → granted, but only while the app is open
 * - `off` → no location permission
 */
export async function getLocationStatus(): Promise<LocationStatus> {
  const fg = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (!fg?.granted) return "off";
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  return bg?.granted ? "ready" : "foreground_only";
}

export async function isDayTracking(): Promise<boolean> {
  // Once the SE has ended their day (the manual "End day" button), the tile must
  // read off even though the day-on flag may linger until midnight. A day ended
  // today is not tracking. (Logistics never set this flag.)
  if (await dayEndedToday()) return false;
  if (getForegroundWatch()) return true;
  // A day is only "on" if it was started TODAY (date-scoped flag). A stale flag —
  // or a background task left over from an app update — must never read as active.
  if (!(await dayStartedToday())) return false;
  if (getNativeTracking()) return true;
  return Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false);
}
