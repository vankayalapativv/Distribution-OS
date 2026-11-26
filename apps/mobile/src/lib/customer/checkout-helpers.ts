import { getLocalDb } from "../db";
import { checkInFence } from "../geo";
import { recordFollowup } from "./followups";
import type { Captured, CheckOutOpts, Fix, PickDateTime, PromptReason } from "./checkout-types";

/** Capture the mandatory no-outcome reason, then offer an optional follow-up
 *  reminder time (the customer "will pay next week"). Returns null when the SE
 *  cancels the reason; a skipped reminder ("Not now") is `followUpAt: null`. */
export async function captureNoOutcome(
  promptReason: PromptReason,
  pickDateTime: PickDateTime,
): Promise<Captured | null> {
  const reason = await promptReason();
  if (!reason) return null;
  const followUpAt = await pickDateTime();
  return { reason, followUpAt };
}

/** Mirror a captured follow-up into the local store so it resurfaces at the next
 *  check-in and feeds the Reminders tab — even fully offline. */
export function mirrorFollowup(opts: CheckOutOpts, captured: Captured): void {
  const db = getLocalDb();
  if (db)
    recordFollowup(
      db,
      { customerId: opts.customerId, customerName: opts.customerName, ...captured },
      Date.now(),
    );
}

/** Client-side geofence check for a friendly message (the server enforces it too):
 *  null → within range (continue); true → too far and the SE chose "Try again";
 *  false → too far and gave up. */
export async function geofenceStop(
  fix: Fix,
  saved: CheckOutOpts["saved"],
  customerName: string,
  confirm: CheckOutOpts["confirm"],
): Promise<boolean | null> {
  if (saved.latitude == null || saved.longitude == null) return null;
  const fence = checkInFence(fix, { latitude: saved.latitude, longitude: saved.longitude });
  if (fence.allowed) return null;
  return confirm({
    title: "Too far from the shop",
    message: `You're about ${fence.distanceM >= 1000 ? `${(fence.distanceM / 1000).toFixed(1)} km` : `${fence.distanceM} m`} from ${customerName}. Move within 100 m to check out.`,
    confirmLabel: "Try again",
  });
}
