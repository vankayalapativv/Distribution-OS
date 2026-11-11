"use client";

import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Last day of a month as `yyyy-mm-dd` (day-number math is timezone-safe). */
function monthEndYmd(year: number, month0: number): string {
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Format any date-ish value (`yyyy-mm-dd` or ISO) as e.g. "Aug 2028"; "" when blank. */
export function formatMonthYear(value: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(value);
  if (!m) return "";
  const month0 = Number(m[2]) - 1;
  if (month0 < 0 || month0 > 11) return "";
  return `${MONTHS[month0]} ${m[1]}`;
}

/** Parse a `yyyy-mm-dd` value into {year, month0}; null when blank/invalid. */
function parse(value: string): { year: number; month0: number } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
  if (!m) return null;
  const month0 = Number(m[2]) - 1;
  if (month0 < 0 || month0 > 11) return null;
  return { year: Number(m[1]), month0 };
}

/**
 * Month + year picker — no day, no range limit. Its value is a `yyyy-mm-dd`
 * string set to the LAST day of the chosen month (end-of-month expiry), and it
 * displays as e.g. "Nov 2026". Shared field; used for stock expiry dates.
 */
export function MonthYearField({
  value,
  onChange,
  placeholder = "Pick a month",
  className,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
}) {
  const parsed = parse(value);
  const [open, setOpen] = useState(false);
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth0 = now.getMonth();
  // Open on the chosen month's year, else the current year (never a past year).
  const initialYear = Math.max(parsed?.year ?? curYear, curYear);
  const [viewYear, setViewYear] = useState(initialYear);
  const atFloorYear = viewYear <= curYear; // can't page before the current year

  return (
    <Popover
      open={open}
      onOpenChange={(o) => { setOpen(o); if (o) setViewYear(Math.max(parsed?.year ?? curYear, curYear)); }}
    >
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:border-primary focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
          className,
        )}
      >
        <span className={parsed ? "text-foreground" : "text-muted-foreground"}>
          {parsed ? `${MONTHS[parsed.month0]} ${parsed.year}` : placeholder}
        </span>
        {!parsed && <CalendarIcon size={14} className="shrink-0 opacity-40" />}
      </PopoverTrigger>
      <PopoverContent className="w-[232px] p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Previous year" disabled={atFloorYear} onClick={() => setViewYear((y) => Math.max(y - 1, curYear))} className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
          <button type="button" aria-label="Next year" onClick={() => setViewYear((y) => y + 1)} className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((m, i) => {
            const selected = parsed?.year === viewYear && parsed?.month0 === i;
            const past = viewYear < curYear || (viewYear === curYear && i < curMonth0);
            return (
              <button
                key={m}
                type="button"
                disabled={past}
                onClick={() => { onChange(monthEndYmd(viewYear, i)); setOpen(false); }}
                className={cn(
                  "rounded-md py-1.5 text-sm font-medium transition-colors",
                  past && "cursor-not-allowed text-muted-foreground/30 hover:bg-transparent",
                  !past && selected && "bg-primary text-primary-foreground",
                  !past && !selected && "text-foreground hover:bg-accent",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
