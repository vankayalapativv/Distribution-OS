"use client";

import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { parseISO } from "date-fns";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PRESETS, triggerLabel, type LedgerPreset } from "./customer-ledger-range-data";
import { useLedgerCalendar } from "./use-ledger-calendar";

export { presetRange, type LedgerPreset } from "./customer-ledger-range-data";

/**
 * Ledger date-range control: preset chips (This month / Last month / Last 3
 * months / This FY / All time) plus a shadcn Popover + range Calendar for
 * custom ranges. A preset click commits immediately; a custom range commits once
 * BOTH ends are picked (2nd click). There is no Apply button — committing fetches.
 */
export function LedgerDateRange({
  from,
  to,
  preset,
  open,
  onOpenChange,
  onPreset,
  onCalendar,
}: {
  readonly from: string;
  readonly to: string;
  readonly preset: LedgerPreset;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPreset: (p: Exclude<LedgerPreset, "custom">) => void;
  readonly onCalendar: (sel: DateRange | undefined) => void;
}) {
  const { calSel, handleOpenChange, handleSelect } = useLedgerCalendar({ onCalendar, onOpenChange });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPreset(p.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              preset === p.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none">
          <CalendarIcon size={14} className="opacity-60" />
          {triggerLabel(from, to, preset)}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <LazyCalendar
            mode="range"
            selected={calSel}
            onSelect={handleSelect}
            disabled={{ after: new Date() }}
            numberOfMonths={2}
            defaultMonth={from ? parseISO(from) : undefined}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
