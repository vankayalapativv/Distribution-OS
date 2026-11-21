"use client";

import { useRef, useState } from "react";
import type { DateRange } from "react-day-picker";

/**
 * Open-state for a range-calendar popover that auto-closes once a full From→To
 * range has been picked. react-day-picker (v10) returns a *same-day* range on the
 * FIRST click, so "both ends set" can't tell the first click from the second —
 * we track start/end clicks and close only on the end click. `apply` runs on
 * every click so the selection (and any live filtering) updates immediately.
 */
export function useRangeAutoClose(apply: (sel: DateRange | undefined) => void) {
  const [open, setOpen] = useState(false);
  const phase = useRef<"start" | "end">("start");

  const onOpenChange = (next: boolean) => {
    if (next) phase.current = "start"; // reset each time the calendar opens
    setOpen(next);
  };

  const onSelect = (sel: DateRange | undefined) => {
    apply(sel);
    if (!sel?.from) return;
    if (phase.current === "start") phase.current = "end";
    else {
      phase.current = "start";
      setOpen(false); // end click → the range is complete; close
    }
  };

  return { open, onOpenChange, onSelect };
}
