import { apiFetch } from "../api";
import { ApiRequestError } from "../api-core";
import { captureNoOutcome, mirrorFollowup } from "./checkout-helpers";
import type { Captured, CheckOutOpts, Fix } from "./checkout-types";

/** One online POST attempt; handles the server's no-outcome-reason demand by
 *  capturing the reason (and an optional follow-up reminder) once and retrying.
 *  `serverId` is the resolved server visit id. On success with a captured
 *  no-outcome, the follow-up is mirrored locally so it resurfaces offline. */
export async function postCheckout(
  opts: CheckOutOpts,
  serverId: string,
  fix: Fix,
  captured: Captured | null,
): Promise<boolean> {
  try {
    await apiFetch(`/visits/${serverId}/checkout`, {
      method: "POST",
      token: opts.token,
      body: {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        ...(captured?.reason ? { reason: captured.reason } : {}),
        ...(captured?.followUpAt ? { followUpAt: captured.followUpAt } : {}),
      },
    });
    if (captured) mirrorFollowup(opts, captured);
    return true;
  } catch (e) {
    return handleCheckoutError(e, opts, serverId, fix, captured);
  }
}

/** Map a failed checkout POST to a terminal result: CONFLICT → already done;
 *  NO_OUTCOME_REASON → capture a reason and retry once; OUT_OF_RANGE → prompt and
 *  stop. Anything else re-throws. */
async function handleCheckoutError(
  e: unknown,
  opts: CheckOutOpts,
  serverId: string,
  fix: Fix,
  captured: Captured | null,
): Promise<boolean> {
  if (e instanceof ApiRequestError) {
    // Already closed (e.g. the midnight auto-close won the race) — done either way.
    if (e.code === "CONFLICT") return true;
    // No order + no collection: capture reason + optional reminder, retry once.
    if (e.code === "NO_OUTCOME_REASON" && !captured) {
      const next = await captureNoOutcome(opts.promptReason, opts.pickDateTime);
      if (!next) return false;
      return postCheckout(opts, serverId, fix, next);
    }
    if (e.code === "OUT_OF_RANGE") {
      void opts.confirm({
        title: "Too far from the shop",
        message: "You're too far from the shop to check out. Move within 100 m and try again.",
        confirmLabel: "OK",
      });
      return false;
    }
  }
  throw e;
}
