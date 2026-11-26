import { router } from "expo-router";
import { ApiRequestError } from "../api-core";
import { getLocalDb } from "../db";
import { kickSync } from "../sync";
import type { WriteOutcome } from "../online-first";
import { showFollowupIfAny } from "./checkin-followup";
import type { CheckInOpts, Confirm } from "./checkin-types";

/**
 * OPEN_VISIT rejection: the SE is still checked in at another shop. Offer a jump
 * straight to that open customer so they can check out there. Returns true when
 * handled (there was a target customer), false to fall through to a generic error.
 */
async function offerGoToOpenVisit(error: ApiRequestError, confirm: Confirm): Promise<boolean> {
  const details = error.details as { customerId?: string; customerName?: string } | undefined;
  if (!details?.customerId) return false;
  const go = await confirm({
    title: "Finish your current visit",
    message: error.message, // "Finish your visit at <shop> first."
    confirmLabel: "Go to visit",
    cancelLabel: "Not now",
  });
  if (go) {
    router.push({
      pathname: "/customer/[id]",
      params: { id: details.customerId, name: details.customerName ?? "" },
    });
  }
  return true;
}

/** Turn the write outcome into a result: the visit handle on success, or an
 *  explanatory dialog + null on queue (offline) / reject / unsaved. */
export async function handleCheckInOutcome(
  outcome: WriteOutcome<{ visitId: string }>,
  opts: CheckInOpts,
  clientUuid: string,
): Promise<string | null> {
  const { id, token, customerName, confirm } = opts;

  if (outcome.status === "sent") {
    await showFollowupIfAny(getLocalDb(), id, customerName, confirm, token);
    return outcome.data.visitId ?? clientUuid;
  }
  if (outcome.status === "queued") {
    void kickSync(); // best-effort immediate flush attempt
    await showFollowupIfAny(getLocalDb(), id, customerName, confirm, token);
    return clientUuid; // the local visit handle; checkout resolves it via the local row
  }

  const rejection =
    outcome.status === "rejected" && outcome.error instanceof ApiRequestError ? outcome.error : null;

  if (rejection?.code === "OPEN_VISIT" && (await offerGoToOpenVisit(rejection, confirm))) {
    return null;
  }

  // Other rejections (permanent 4xx) or unsaved (no local DB). On a rejection,
  // surface the SERVER's own message (e.g. "You've already completed a visit here
  // today.") so the SE knows WHY, instead of a generic "pull to refresh".
  const message =
    outcome.status === "unsaved"
      ? "Couldn't save the check-in on this device. Try again."
      : (rejection?.message ?? "The server rejected this check-in. Pull to refresh and try again.");
  void confirm({ title: "Check-in failed", message, confirmLabel: "OK" });
  return null;
}
