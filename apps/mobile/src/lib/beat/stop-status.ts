import { istHour } from "../day-flag";

/** 8 PM IST — the workday cutoff (same as GPS tracking auto-stop). After this a
 *  still-unvisited beat stop counts as "missed". */
const DAY_END_HOUR_IST = 20;

/**
 * Effective beat-stop status for display. A stop still `pending` once the 8 PM
 * day-end has passed reads as `missed` — the SE never visited it. Before the
 * cutoff it stays `pending` (they might still go). `completed` is unchanged.
 */
export function effectiveStopStatus(stopStatus: string): string {
  if (stopStatus === "pending" && istHour() >= DAY_END_HOUR_IST) return "missed";
  return stopStatus;
}

/**
 * A stop counts as "done" ONLY after the SE has checked OUT (`completed`).
 * A `checked_in` stop (arrived, not yet checked out) is in-progress, not done —
 * so the SE must check out to mark the visit complete (decided 2026-10-05).
 * `checked_in` therefore shows its own "Checked in" pill and is excluded from the
 * done tally until checkout.
 */
export function isStopDone(stopStatus: string): boolean {
  return stopStatus === "completed";
}
