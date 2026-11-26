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
import { ApiRequestError } from "../api-core";
import { getIsOnline } from "../connectivity";
import { getLocalDb } from "../db";
import { getCheckInFix } from "../gps";
import { completeOfflineCheckout } from "./checkout-offline";
import { geofenceStop } from "./checkout-helpers";
import { postCheckout } from "./checkout-post";
import type { CheckOutOpts } from "./checkout-types";

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

  // Offline (or the check-in hasn't synced): we can't ask the server, so decide
  // the no-outcome reason from the local outbox (see completeOfflineCheckout).
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
