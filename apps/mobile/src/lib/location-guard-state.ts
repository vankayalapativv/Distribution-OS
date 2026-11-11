// Debounced state machine for the mid-day location guard. The block has NO
// escape hatch, so a false positive would strand a working rep — this reducer is
// the safety net: a bad reading must be CONFIRMED across several consecutive
// samples before the blocker locks the screen, while a single healthy reading
// clears it instantly (unblock fast the moment the rep fixes it).

import type { LocationBlockReason } from "./location-health";

/**
 * How many consecutive bad readings confirm a real problem before blocking.
 * 2 = one confirmation — fast enough to gate the screen ~1s after opening with
 * location off, while still rejecting a single fluke read. (Only a DEFINITE
 * denial counts as bad; an "unknown"/failed read is never bad — see
 * location-health — so this can't false-lock a rep even with no escape hatch.)
 */
export const REQUIRED_CONSECUTIVE_BAD = 2;

export interface GuardState {
  blocked: boolean;
  reason: LocationBlockReason | null;
  consecutiveBad: number;
}

export const initialGuardState: GuardState = { blocked: false, reason: null, consecutiveBad: 0 };

export function reduceGuard(state: GuardState, reading: LocationBlockReason | null): GuardState {
  if (reading === null) return initialGuardState; // healthy → clear immediately
  const consecutiveBad = state.consecutiveBad + 1;
  const blocked = state.blocked || consecutiveBad >= REQUIRED_CONSECUTIVE_BAD;
  return { blocked, reason: reading, consecutiveBad };
}
