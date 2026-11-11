/**
 * Check-in geofence: an SE must be within CHECKIN_RADIUS_M of the customer's
 * saved location. GPS accuracy is forgiven — a weak fix at the shop must not
 * block a legitimate check-in — so the rule is (distance − accuracy) ≤ radius.
 */

export const CHECKIN_RADIUS_M = 100;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface CheckInFenceResult {
  allowed: boolean;
  /** Raw distance in metres (rounded), for the "you're ~340 m away" message. */
  distanceM: number;
}

/**
 * Fence verdict for a check-in attempt. `accuracy` is the GPS fix's radius in
 * metres (null when the platform doesn't report one → treated as exact).
 */
export function checkInFence(
  fix: { latitude: number; longitude: number; accuracy: number | null },
  saved: { latitude: number; longitude: number },
): CheckInFenceResult {
  const distanceM = Math.round(
    distanceMeters(fix.latitude, fix.longitude, saved.latitude, saved.longitude),
  );
  const effective = distanceM - Math.max(0, fix.accuracy ?? 0);
  return { allowed: effective <= CHECKIN_RADIUS_M, distanceM };
}
