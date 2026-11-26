import { router } from "expo-router";
import { apiFetch } from "../api";
import { checkInFence } from "../geo";
import { getCheckInFix, isDayTracking } from "../gps";
import type { CheckInFix, CheckInOpts } from "./checkin-types";

/** "1.2 km" past a kilometre, else "320 m" — the distance in the too-far prompt. */
function formatDistanceAway(distanceM: number): string {
  if (distanceM >= 1000) return `${(distanceM / 1000).toFixed(1)} km`;
  return `${distanceM} m`;
}

/** Preflight result: proceed with the fix, stop silently, or re-run the flow. */
export type Preflight = { status: "ok"; fix: CheckInFix } | { status: "stop" } | { status: "retry" };

/**
 * Day-gate (SE only) → fresh GPS fix → geofence (or self-heal when the customer
 * has no saved location). Returns the validated fix, or asks the caller to stop
 * or retry. Each failing step shows its own dialog.
 */
export async function preflightCheckIn(opts: CheckInOpts, isAdmin: boolean): Promise<Preflight> {
  const { id, token, customerName, saved, confirm } = opts;

  // Starting the day belongs to the Home-screen Start-day button, which owns the
  // whole permission + GPS-tracking flow. The check-in button must NOT start the
  // day itself: doing it inline here and then immediately checking in raced the
  // just-started tracking session and failed the FIRST check-in ("check your
  // connection") while a second tap (day already on) worked. So when the day
  // isn't started, point the SE to Home and stop — no inline start. Super Admins
  // have no beat/day (all visits ad-hoc), so they skip this gate.
  if (!isAdmin && !(await isDayTracking())) {
    const goHome = await confirm({
      title: "Start your day first",
      message: "Go to the Home screen and tap Start day before checking in at a customer.",
      confirmLabel: "Go to Home",
      cancelLabel: "OK",
    });
    if (goHome) router.push("/(tabs)");
    return { status: "stop" };
  }

  const fix = await getCheckInFix();
  if (!fix) {
    void confirm({
      title: "Location required",
      message: "Check-in records where you are — enable location permission and try again.",
      confirmLabel: "OK",
    });
    return { status: "stop" };
  }

  // The geofence needs a FRESH reading — a stale last-known fix (e.g. from an
  // earlier shop) could wrongly pass the fence. Make the SE retry for a real fix.
  if (!fix.fresh) {
    void confirm({
      title: "Getting your location",
      message:
        "Couldn't get a fresh GPS reading. Move to an open area, wait a moment, and try again.",
      confirmLabel: "OK",
    });
    return { status: "stop" };
  }

  if (saved.latitude != null && saved.longitude != null) {
    const fence = checkInFence(fix, { latitude: saved.latitude, longitude: saved.longitude });
    if (!fence.allowed) {
      const retry = await confirm({
        title: "Too far from the shop",
        message: `You're about ${formatDistanceAway(fence.distanceM)} from ${customerName}'s saved location. Move within 100 m to check in.`,
        confirmLabel: "Try again",
      });
      return retry ? { status: "retry" } : { status: "stop" };
    }
  } else {
    // No saved location yet: self-heal by saving this fix online (no local write).
    void apiFetch(`/customers/${id}`, {
      method: "PATCH",
      token,
      body: { latitude: fix.latitude, longitude: fix.longitude },
    }).catch(() => undefined);
  }

  return { status: "ok", fix };
}
