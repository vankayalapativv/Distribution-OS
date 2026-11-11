/**
 * Queue-item dispatcher: maps each queued offline write to its API call. Phase 2
 * grows this per entity; it currently handles the visit check-in / check-out
 * path (Sri Aparajita delivery stays online-first, so it is NOT queued here).
 */
import { apiFetch } from "./api";
import { ApiRequestError } from "./api-core";
import { useAuth } from "./auth";
import { getLocalDb } from "./db";
import { SyncHttpError, type SyncQueueItem } from "./sync-core";
import { sendCollection } from "./sync-send-collection";
import { sendDeliveryEnd, sendDeliveryStart } from "./sync-send-delivery";
import { sendDeliveryStop } from "./sync-send-delivery-stop";
import type { LocalDb } from "./local-db";

type Json = Record<string, unknown>;

/** Check-out targets the server visit id, which FIFO guarantees is set by now
 *  (the same-day check-in synced first and applyServerResult filled server_id). */
async function sendVisitCheckout(item: SyncQueueItem, db: LocalDb, token: string | null): Promise<Json> {
  const visit = db.first<{ server_id: string | null }>(
    "select server_id from visits where client_uuid = ?",
    [item.clientUuid],
  );
  if (!visit?.server_id) {
    throw new SyncHttpError(409, "Check-in has not synced yet."); // retryable → waits
  }
  return (await apiFetch(`/visits/${visit.server_id}/checkout`, {
    method: "POST",
    body: item.payload,
    token,
  })) as Json;
}

/** Dispatch a queue item to its API call. Throws ApiRequestError on HTTP failure. */
function dispatch(item: SyncQueueItem, db: LocalDb, token: string | null): Promise<Json | undefined> {
  switch (item.entityType) {
    case "visit_checkin":
      return apiFetch("/visits/checkin", { method: "POST", body: item.payload, token }) as Promise<Json>;
    case "visit_checkout":
      return sendVisitCheckout(item, db, token);
    case "order":
      return apiFetch("/orders", { method: "POST", body: item.payload, token }) as Promise<Json>;
    case "collection":
      return sendCollection(item, db, token);
    case "delivery_start":
      return sendDeliveryStart(item, db, token);
    case "delivery_stop":
      return sendDeliveryStop(item, db, token);
    case "delivery_end":
      return sendDeliveryEnd(item, db, token);
    default:
      // Not yet wired (order/collection land in later phases). Park it rather
      // than loop — a permanent 4xx surfaces it in the Settings failed list.
      throw new SyncHttpError(400, `Unsupported queue entity: ${item.entityType}`);
  }
}

/** Maps a queue item to its API call. Throws SyncHttpError for HTTP failures. */
export async function sendItem(
  item: SyncQueueItem,
): Promise<Record<string, unknown> | undefined> {
  const token = useAuth.getState().token;
  const db = getLocalDb()!; // only reachable from kickSync, which checks db

  try {
    return await dispatch(item, db, token);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new SyncHttpError(error.status, error.message);
    }
    throw error; // network failure → retryable
  }
}
