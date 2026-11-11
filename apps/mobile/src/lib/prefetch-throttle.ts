/**
 * Decide whether a throttled prefetch should run right now.
 *
 * - `force`: a full reconcile ("Refresh all data") — always runs (upstream it also
 *   ignores the delta cursor, doing a full re-pull).
 * - `bypassThrottle`: foreground / reconnect — ignore the time window so a resume
 *   pulls the latest, but the caller KEEPS the delta cursor (cheap changed-only
 *   pull). This is the fix for "only a full app kill refreshes data": the throttle
 *   timers survive backgrounding, so without this a background→resume would skip.
 *
 * Otherwise, skip while still inside the throttle window.
 */
export function shouldPrefetch(
  now: number,
  lastAt: number,
  intervalMs: number,
  opts: { force?: boolean; bypassThrottle?: boolean } = {},
): boolean {
  if (opts.force || opts.bypassThrottle) return true;
  return now - lastAt >= intervalMs;
}
