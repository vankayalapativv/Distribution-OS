import { useCallback, useRef, useState } from "react";

/**
 * Pull-to-refresh helper: returns `{ refreshing, onRefresh }` for a
 * `RefreshControl`. `onRefresh` is stable (safe as a dep) but always runs the
 * latest `fn`, and toggles the spinner around it. Errors are swallowed so a
 * failed refresh (e.g. offline) still hides the spinner.
 */
export function usePullRefresh(fn: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fnRef.current();
    } catch {
      // best-effort — never leave the spinner stuck on a failed refresh
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
