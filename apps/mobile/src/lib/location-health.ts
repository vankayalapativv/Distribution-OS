// Pure evaluation of a field user's live location health, for the mid-day
// tracking guard. Kept free of React/native modules so it's unit-testable.
//
// Design rule: only a DEFINITE denial blocks. An unknown/undetermined read (a
// permission API that failed or hasn't settled) is NOT treated as a denial —
// blocking on it would falsely lock a rep out of the app (there is no escape
// hatch), so we err toward not blocking and let the debounce confirm.

import type { PermissionState } from "./sync-core";

export type LocationBlockReason = "gps_off" | "foreground_denied" | "background_denied";

export interface LocationHealthInput {
  /** Device location services toggle. null = unknown (read failed). */
  isLocationEnabled: boolean | null;
  foregroundPermission: PermissionState;
  /** "Allow all the time". */
  backgroundPermission: PermissionState;
}

/**
 * The most fundamental location problem, or null if healthy. Order matters — we
 * surface the deepest fix first (turning GPS back on is pointless if the app
 * permission is also revoked).
 */
export function evaluateLocationHealth(input: LocationHealthInput): LocationBlockReason | null {
  if (input.isLocationEnabled === false) return "gps_off";
  if (input.foregroundPermission === "denied") return "foreground_denied";
  if (input.backgroundPermission === "denied") return "background_denied";
  return null;
}
