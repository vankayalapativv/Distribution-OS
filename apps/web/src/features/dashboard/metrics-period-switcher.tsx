"use client";

import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { rangeLabel, type Preset } from "./metrics-helpers";

export function MetricsPeriodSwitcher({
  preset,
  range,
  calOpen,
  calRange,
  onPreset,
  onCalOpenChange,
  onCalendar,
}: {
  readonly preset: Preset;
  readonly range: { from: string; to: string };
  readonly calOpen: boolean;
  readonly calRange: DateRange | undefined;
  readonly onPreset: (next: Preset) => void;
  readonly onCalOpenChange: (open: boolean) => void;
  readonly onCalendar: (sel: DateRange | undefined) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
        {(["today", "week", "month"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPreset(p)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              preset === p ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <Popover open={calOpen} onOpenChange={onCalOpenChange}>
        <PopoverTrigger className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none">
          <CalendarIcon size={14} className="opacity-60" />
          {rangeLabel(range.from, range.to)}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <LazyCalendar
            mode="range"
            selected={calRange}
            onSelect={onCalendar}
            disabled={{ after: new Date() }}
            numberOfMonths={1}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
