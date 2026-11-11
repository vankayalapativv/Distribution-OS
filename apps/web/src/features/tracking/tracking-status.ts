import type { TrackedExecutive } from "./tracking-api";

/**
 * An SE is "live" if their last ping is recent (< 12 min). A fresh ping is
 * sufficient proof — the day session ("End day") stops pings, so a recent ping
 * means they're genuinely tracking regardless of the session row.
 */
function isLive(ex: TrackedExecutive): boolean {
  if (!ex.lastRecordedAt) return false;
  return Date.now() - new Date(ex.lastRecordedAt).getTime() < 12 * 60 * 1000;
}

export function statusLabel(ex: TrackedExecutive): string {
  let fallback = "Day ended";
  if (isLive(ex)) fallback = "Fresh";
  else if (ex.sessionStatus === "active") fallback = "Delayed";
  return ex.trackingStatusLabel ?? fallback;
}

export function isFresh(ex: TrackedExecutive): boolean {
  return ex.trackingStatus ? ex.trackingStatus === "fresh" : isLive(ex);
}

const GREEN = "bg-green-50 text-green-700 ring-1 ring-green-600/20";
const AMBER = "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20";
const RED = "bg-red-50 text-red-700 ring-1 ring-red-600/20";
const SLATE = "bg-slate-100 text-slate-600";

export function statusTone(ex: TrackedExecutive): string {
  switch (ex.trackingStatus) {
    case "fresh": return GREEN;
    case "delayed":
    case "locating":
    case "offline_upload_delayed": return AMBER;
    case "gps_disabled":
    case "permission_missing":
    case "tracking_interrupted": return RED;
    case "day_ended":
    case "signed_out": return SLATE;
    default: return isLive(ex) ? GREEN : SLATE;
  }
}

export function statusDot(ex: TrackedExecutive): string {
  switch (ex.trackingStatus) {
    case "fresh": return "bg-green-500";
    case "delayed":
    case "locating":
    case "offline_upload_delayed": return "bg-amber-500";
    case "gps_disabled":
    case "permission_missing":
    case "tracking_interrupted": return "bg-red-500";
    default: return isLive(ex) ? "bg-green-500" : "bg-slate-400";
  }
}
