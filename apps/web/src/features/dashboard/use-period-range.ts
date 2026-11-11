"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { useUrlState } from "@/lib/use-url-state";
import { isoDate, presetRange, type Preset } from "./metrics-helpers";

const PRESETS = new Set<Preset>(["today", "week", "month", "custom"]);

/** A {from,to} day-range → a calendar DateRange (local-midnight Dates), so the
 *  calendar highlights the whole active range. Parsed as local midnight to avoid
 *  a UTC off-by-one day. */
function toCalRange(r: { from: string; to: string }): DateRange {
  return { from: new Date(`${r.from}T00:00:00`), to: new Date(`${r.to}T00:00:00`) };
}

/**
 * The dashboard's period selection, stored in the URL so it survives Back +
 * refresh and is captured by the drill-down history entries:
 *  - `?period=week|month|custom` (today = no param, the default/clean URL)
 *  - `?from=&to=` for a custom range.
 * Period changes write with `replace` (no history noise). The custom-range
 * calendar's open/closed popover stays local (transient UI, not a view state).
 */
export function usePeriodRange(initialRange: { from: string; to: string }) {
  const { get, set } = useUrlState();
  const [calOpen, setCalOpen] = useState(false);

  const rawPreset = get("period");
  const preset: Preset = PRESETS.has(rawPreset as Preset) ? (rawPreset as Preset) : "today";

  // Resolve the active range from the URL. With no period param we keep the
  // server-seeded initial range (today) so the first paint needs no refetch.
  const range = (() => {
    if (preset === "custom") {
      const from = get("from");
      const to = get("to");
      return from && to ? { from, to } : initialRange;
    }
    return rawPreset ? presetRange(preset) : initialRange;
  })();

  const calRange = toCalRange(range);

  function applyPreset(next: Preset) {
    if (next === "custom") {
      set({ period: "custom" }); // the calendar then sets from/to
      return;
    }
    // today → clean URL (no param); week/month → the param.
    set({ period: next === "today" ? null : next, from: null, to: null });
  }

  function applyCalendar(sel: DateRange | undefined) {
    if (sel?.from) set({ period: "custom", from: isoDate(sel.from), to: isoDate(sel.to ?? sel.from) });
  }

  return { preset, range, calOpen, setCalOpen, calRange, applyPreset, applyCalendar };
}
