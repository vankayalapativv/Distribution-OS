/** Event name the sidebar badge island listens on to re-pull its counts. */
export const BADGE_REFRESH_EVENT = "badge-counts:refresh";

/**
 * Signal the sidebar Alerts/Tasks badges to refetch immediately.
 *
 * Call this right after any mutation that changes those counts (alert close,
 * task create, task status change). The badge runs in its own isolated
 * QueryClient with no shared provider, so ordinary `invalidateQueries` can't
 * reach it — a window event is the simplest cross-boundary nudge. Without this,
 * the badge would only update on its 60s poll or a full navigation.
 */
export function refreshBadges(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BADGE_REFRESH_EVENT));
  }
}
