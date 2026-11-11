"use client";

/** From–to date range control for the Reports page — a single calendar popover,
 *  no presets. Defaults to today. Applies instantly on the second click. */
import { useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ReportRange } from "./reports-types";

const ISO = "yyyy-MM-dd";

export function todayRange(): ReportRange {
  const t = format(new Date(), ISO);
  return { from: t, to: t };
}

function triggerLabel(from: string, to: string): string {
  const f = format(parseISO(from), "dd MMM yyyy");
  const t = format(parseISO(to), "dd MMM yyyy");
  return from === to ? f : `${f} – ${t}`;
}

export function ReportsRangePicker({
  range,
  onChange,
}: {
  readonly range: ReportRange;
  readonly onChange: (range: ReportRange) => void;
}) {
  const [open, setOpen] = useState(false);
  // Calendar starts blank each open; react-day-picker returns a same-day range on
  // the first click, so we close only after the second (end) click.
  const [calSel, setCalSel] = useState<DateRange | undefined>(undefined);
  const pickPhase = useRef<"start" | "end">("start");

  const handleOpenChange = (o: boolean, details?: { reason?: string }) => {
    if (!o && details?.reason === "focus-out") return;
    if (o) {
      setCalSel(undefined);
      pickPhase.current = "start";
    }
    setOpen(o);
  };

  const handleSelect = (sel: DateRange | undefined) => {
    setCalSel(sel);
    if (!sel?.from) return;
    if (pickPhase.current === "start") {
      pickPhase.current = "end";
      return;
    }
    pickPhase.current = "start";
    const from = format(sel.from, ISO);
    const to = sel.to ? format(sel.to, ISO) : from;
    onChange({ from, to });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none">
        <CalendarIcon size={14} className="opacity-60" />
        {triggerLabel(range.from, range.to)}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <LazyCalendar
          mode="range"
          selected={calSel}
          onSelect={handleSelect}
          disabled={{ after: new Date() }}
          numberOfMonths={2}
          defaultMonth={parseISO(range.from)}
        />
      </PopoverContent>
    </Popover>
  );
}
