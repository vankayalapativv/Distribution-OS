import type { RoutePoint, TrackedExecutive } from "./tracking-api";
import { timeAgo } from "./tracking-format";

// Re-exported so existing `from "./tracking-helpers"` imports keep working; the
// format/status helpers now live in their own files.
export { timeAgo, fmtTime } from "./tracking-format";
export { statusLabel, isFresh, statusTone, statusDot } from "./tracking-status";

/** Stable empty array so the route-drawing effect doesn't re-run every render. */
export const EMPTY_POINTS: RoutePoint[] = [];

export const REFRESH_MS = 60_000;

export function batterySummary(ex: TrackedExecutive): string | null {
  if (ex.batteryPercentage == null) return null;
  return `Battery ${Math.round(ex.batteryPercentage)}% · updated ${timeAgo(ex.lastHeartbeatAt ?? null)}`;
}

export function healthReasons(ex: TrackedExecutive): string[] {
  const reasons: string[] = [];
  if (ex.isLocationEnabled === false) reasons.push("GPS off");
  if (ex.foregroundPermission && ex.foregroundPermission !== "granted") reasons.push("Location permission missing");
  if (ex.backgroundPermission && ex.backgroundPermission !== "granted") reasons.push("Background permission missing");
  if (ex.notificationPermission && ex.notificationPermission !== "granted") reasons.push("Notifications off");
  if (ex.batteryOptimizationStatus === "optimized") reasons.push("Battery optimized");
  if (ex.isConnected === false) reasons.push("Network offline");
  return reasons;
}

function distanceKmLabel(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

/** Whole-km odometer reading with Indian digit grouping (e.g. 45,200). */
function odometerLabel(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}

export function distanceSummary(ex: TrackedExecutive): { total: string; quality: string } | null {
  if (ex.totalDistanceKm == null) return null;
  const total = `Total distance: ${distanceKmLabel(ex.totalDistanceKm)} km`;
  // Show the SE-entered Start/End odometer readings in place of the GPS
  // point-count line. End reads "—" until the day is ended. Falls back to the
  // point-count quality for sessions with no odometer (older days / Logistics).
  if (ex.startOdometer != null) {
    const end = ex.endOdometer != null ? `${odometerLabel(ex.endOdometer)} km` : "—";
    return { total, quality: `Start ${odometerLabel(ex.startOdometer)} km · End ${end}` };
  }
  const accepted = ex.acceptedDistancePointCount ?? 0;
  const rejected = ex.rejectedDistancePointCount ?? 0;
  return {
    total,
    quality: `Calculated from ${accepted} accepted point${accepted === 1 ? "" : "s"} · ${rejected} excluded`,
  };
}
