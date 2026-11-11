"use client";

import { useRef, useState } from "react";
import type { DateRange } from "react-day-picker";

/**
 * Two-click range-calendar state for the ledger date picker.
 *
 * react-day-picker (range mode) returns a COMPLETE same-day range on the first
 * click ({from:X, to:X}) and extends it to {from:X, to:Y} on the second — so we
 * can't close on "from && to". Instead we toggle a phase: click 1 sets the start
 * (keep open), click 2 sets the end (commit + close).
 */
export function useLedgerCalendar({
  onCalendar,
  onOpenChange,
}: {
  onCalendar: (sel: DateRange | undefined) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [calSel, setCalSel] = useState<DateRange | undefined>(undefined);
  const pickPhase = useRef<"start" | "end">("start");

  const handleOpenChange = (o: boolean, details?: { reason?: string }) => {
    // Ignore a stray focus-out dismissal (calendar re-render can bounce focus to
    // <body>); Escape / outside-press / trigger still close it normally.
    if (!o && details?.reason === "focus-out") return;
    if (o) {
      setCalSel(undefined);
      pickPhase.current = "start";
    }
    onOpenChange(o);
  };

  const handleSelect = (sel: DateRange | undefined) => {
    setCalSel(sel);
    if (pickPhase.current === "start") {
      pickPhase.current = "end"; // first click → keep open, don't commit yet
    } else {
      pickPhase.current = "start";
      onCalendar(sel); // second click → commit (parent fetches immediately)
      onOpenChange(false);
    }
  };

  return { calSel, handleOpenChange, handleSelect };
}
