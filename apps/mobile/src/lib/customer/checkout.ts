/**
 * Visit check-out for the customer screen — online-first with an offline queue
 * fallback. Requires a GPS fix inside the same 100 m geofence as check-in.
 *
 * Online, the server drives the mandatory no-outcome reason (422
 * NO_OUTCOME_REASON) exactly as before. Offline — or when the visit was checked
 * in offline and its server id isn't known yet — we can't ask the server, so we
 * prompt for the reason proactively (the server accepts a supplied reason even
 * when there was an outcome) and queue the check-out; the sync-send handler
 * resolves the server id once the check-in has synced (FIFO).
 */
import type { ConfirmOptions } from "../../components/dialog";
import { apiFetch } from "../api";
import { ApiRequestError } from "../api-core";
import { getIsOnline } from "../connectivity";
import { getLocalDb } from "../db";
import { istDate } from "../day-flag";
import { checkInFence } from "../geo";
import { getCheckInFix } from "../gps";
import { kickSync } from "../sync";
import { recordFollowup } from "./followups";
import { ensureCheckoutQueued, localVisitHasOutcome } from "./visit-queue";

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;
type PromptReason = () => Promise<string | null>;
type PickDateTime = (opts?: {
  title?: string;
  message?: string;
  initial?: Date;
}) => Promise<string | null>;

interface CheckOutOpts {
  /** Server visit id (online/header visit) OR the check-in clientUuid (offline). */
  visitId: string;
  /** Customer id — needed to seed a header-only visit row when queueing offline. */
  customerId: string;
  token: string | null;
  customerName: string;
  saved: { latitude: number | null; longitude: number | null };
  confirm: Confirm;
  promptReason: PromptReason;
  /** Optional follow-up reminder picker, offered after a no-outcome reason. */
  pickDateTime: PickDateTime;
}

type Fix = { latitude: number; longitude: number; accuracy: number | null };

interface Captured {
  reason: string;
  followUpAt: string | null;
}

/** Capture the mandatory no-outcome reason, then offer an optional follow-up
 *  reminder time (the customer "will pay next week"). Returns null when the SE
 *  cancels the reason; a skipped reminder ("Not now") is `followUpAt: null`. */
async function captureNoOutcome(
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
function mirrorFollowup(opts: CheckOutOpts, captured: Captured): void {
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
async function geofenceStop(
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

/** Offline (or pre-sync) path: decide the no-outcome reason from the local outbox
 *  (skip the prompt when there's a local order/collection for this customer today),
 *  durably queue the checkout, mirror any follow-up, and kick a sync. */
async function completeOfflineCheckout(
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

/**
 * Runs fix → geofence → record. Returns true once the visit is checked out
 * (synced now, already done, or durably queued).
 */
export async function performCheckOut(opts: CheckOutOpts): Promise<boolean> {
  const { visitId, customerName, saved, confirm } = opts;
  const db = getLocalDb();
  // A local visits row means `visitId` is a check-in clientUuid; its server_id is
  // null until the offline check-in syncs. No local row → `visitId` IS a server id.
  const local =
    db?.first<{ server_id: string | null; customer_id: string }>(
      "select server_id, customer_id from visits where client_uuid = ?",
      [visitId],
    ) ?? null;
  const serverId = local ? local.server_id : visitId;

  const fix = await getCheckInFix();
  if (!fix) {
    void confirm({
      title: "Location required",
      message: "Check-out records where you are — enable location permission and try again.",
      confirmLabel: "OK",
    });
    return false;
  }

  // The geofence needs a FRESH reading — a stale last-known fix could wrongly pass
  // the fence. Make the SE retry for a real fix.
  if (!fix.fresh) {
    void confirm({
      title: "Getting your location",
      message:
        "Couldn't get a fresh GPS reading. Move to an open area, wait a moment, and try again.",
      confirmLabel: "OK",
    });
    return false;
  }

  // Client-side geofence for a friendly message; the server enforces it too.
  const blocked = await geofenceStop(fix, saved, customerName, confirm);
  if (blocked === true) return performCheckOut(opts);
  if (blocked === false) return false;

  // Online with a known server id → the familiar server-driven flow. A network
  // drop mid-request falls through to the offline queue below.
  if (serverId && getIsOnline()) {
    try {
      return await postCheckout(opts, serverId, fix, null);
    } catch (e) {
      if (!(e instanceof ApiRequestError && e.status === 0)) throw e;
    }
  }

  // Offline (or the check-in hasn't synced). We can't ask the server, so decide
  // the no-outcome reason from the local outbox: skip the prompt when there's a
  // local order/collection for this customer today, else prompt once.
  if (!db) {
    void confirm({
      title: "Check-out unavailable",
      message: "Couldn't save on this device. Connect and try again.",
      confirmLabel: "OK",
    });
    return false;
  }
  const customerId = local?.customer_id ?? opts.customerId;
  return completeOfflineCheckout(opts, db, customerId, serverId, fix);
}

/** One online POST attempt; handles the server's no-outcome-reason demand by
 *  capturing the reason (and an optional follow-up reminder) once and retrying.
 *  `serverId` is the resolved server visit id. On success with a captured
 *  no-outcome, the follow-up is mirrored locally so it resurfaces offline. */
async function postCheckout(
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
