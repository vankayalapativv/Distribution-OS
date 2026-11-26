import { getLocalDb } from "../db";
import { istDate } from "../day-flag";
import { kickSync } from "../sync";
import { ensureCheckoutQueued } from "./visit-queue";
import { localVisitHasOutcome } from "./visit-outcome";
import { captureNoOutcome, mirrorFollowup } from "./checkout-helpers";
import type { Captured, CheckOutOpts, Fix } from "./checkout-types";

/** Offline (or pre-sync) path: decide the no-outcome reason from the local outbox
 *  (skip the prompt when there's a local order/collection for this customer today),
 *  durably queue the checkout, mirror any follow-up, and kick a sync. */
export async function completeOfflineCheckout(
  opts: CheckOutOpts,
  db: NonNullable<ReturnType<typeof getLocalDb>>,
  customerId: string,
  serverId: string | null,
  fix: Fix,
): Promise<boolean> {
  let captured: Captured | null = null;
  if (!localVisitHasOutcome(db, customerId, istDate())) {
    captured = await captureNoOutcome(opts.promptReason, opts.pickDateTime);
    if (!captured) return false;
  }
  ensureCheckoutQueued(
    db,
    {
      clientUuid: opts.visitId,
      serverId,
      customerId,
      latitude: fix.latitude,
      longitude: fix.longitude,
      noOutcomeReason: captured?.reason,
      followUpAt: captured?.followUpAt ?? null,
    },
    Date.now(),
  );
  // Mirror the follow-up locally so it resurfaces at the next check-in, offline.
  if (captured) mirrorFollowup(opts, captured);
  void kickSync();
  return true;
}
