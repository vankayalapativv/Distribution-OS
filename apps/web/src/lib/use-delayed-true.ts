"use client";

import { useEffect, useState } from "react";

/**
 * Returns true only once `active` has stayed true for `delayMs`. Used to defer a
 * loading shimmer on refetch (page / filter / date change) so fast responses keep
 * the previous content and only slow ones flip to the skeleton. State is set only
 * from a timer and its cleanup — never synchronously in the effect.
 */
export function useDelayedTrue(active: boolean, delayMs: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setOn(true), delayMs);
    return () => {
      clearTimeout(timer);
      setOn(false);
    };
  }, [active, delayMs]);
  return on;
}
