import { apiFetch } from "../api";
import type { LocalDb } from "../local-db";
import { getOpenFollowup, resolveFollowupLocal } from "./followups";
import type { Confirm } from "./checkin-types";

/** "12 Oct, 3:00 pm" for the follow-up popup. */
function formatFollowupDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** After a check-in, surface the customer's latest OPEN follow-up ("said next
 *  week — payment") and let the SE mark it done. Offline-first (reads the local
 *  mirror). No-op when there's no open follow-up or no local store. */
export async function showFollowupIfAny(
  db: LocalDb | null,
  customerId: string,
  customerName: string,
  confirm: Confirm,
  token: string | null,
): Promise<void> {
  if (!db) return;
  const open = getOpenFollowup(db, customerId);
  if (!open) return;
  const when = open.followUpAt ? `\n\nFollow up: ${formatFollowupDate(open.followUpAt)}` : "";
  const done = await confirm({
    title: "Pending follow-up",
    message: `Last visit, ${customerName} said:\n"${open.reason}"${when}`,
    confirmLabel: "Mark done",
    cancelLabel: "OK",
  });
  if (!done) return;
  resolveFollowupLocal(db, customerId);
  // Best-effort server resolve (office view + stops the push); local is already done.
  void apiFetch(`/followups/customers/${customerId}/resolve`, { method: "POST", token }).catch(
    () => undefined,
  );
}
