/**
 * Customer follow-ups — the capture UX (the optional follow-up reminder picker).
 * The offline store lives in ./followups-store (kept RN-free so it's testable);
 * re-exported here so callers have one import. See docs/PENDING-CUSTOMER-FOLLOWUPS.md.
 */
import { apiFetch } from "../api";
import { resolveFollowupLocal } from "./followups-store";

export {
  getOpenFollowup,
  listFollowupReminders,
  pendingFollowupCount,
  recordFollowup,
  resolveFollowupLocal,
} from "./followups-store";
export type { FollowupReminder, LocalFollowup } from "./followups-store";

/** Mark a customer's open follow-up done: locally now, then best-effort on the
 *  server (so the office view updates and the reminder push stops). Shared by the
 *  check-in popup, the customer card, and the Reminders tab. */
export function resolveFollowup(
  db: import("../local-db").LocalDb,
  customerId: string,
  token: string | null,
): void {
  resolveFollowupLocal(db, customerId);
  void apiFetch(`/followups/customers/${customerId}/resolve`, { method: "POST", token }).catch(
    () => undefined,
  );
}

type PickDateTime = (opts?: {
  title?: string;
  message?: string;
  initial?: Date;
}) => Promise<string | null>;

/** Optional follow-up reminder capture via the in-app (custom, themed) date +
 *  time picker — no native OS picker. Returns an ISO string, or null when the SE
 *  skips ("Not now"). The picker opens on now + 1 hour by default (the SE can
 *  tap a quick chip like "In 5 min" or pick any day + time). */
export function promptFollowUpAt(dialog: { pickDateTime: PickDateTime }): Promise<string | null> {
  return dialog.pickDateTime({
    title: "Set a follow-up reminder?",
    message: "We'll remind you — with this customer's name — at the time you pick.",
  });
}
