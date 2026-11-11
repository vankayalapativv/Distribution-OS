"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ATTENDANCE_STATUS_META, ATTENDANCE_STATUS_ORDER } from "./attendance-api";
import { dayLabel, todayYmd } from "./attendance-format";
import { monthTitle, shiftDay } from "./attendance-grid-utils";

/** YYYY-MM-DD → a local Date at midnight (no tz drift for the calendar). */
function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Prev/next month picker — sits on the tab row (top-right) for the Monthly view. */
export function MonthNav({
  month,
  onShift,
  atCurrentMonth,
}: Readonly<{
  month: string;
  onShift: (by: number) => void;
  atCurrentMonth: boolean;
}>) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="size-9" onClick={() => onShift(-1)} aria-label="Previous month">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[9.5rem] text-center text-sm font-semibold">{monthTitle(month)}</span>
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        onClick={() => onShift(1)}
        disabled={atCurrentMonth}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

/** Prev/next day stepper + a shadcn popover calendar — mirrors the month nav, for the Daily view. */
export function DateNav({ date, setDate }: Readonly<{ date: string; setDate: (d: string) => void }>) {
  const [open, setOpen] = useState(false);
  const today = todayYmd();
  const atToday = date >= today;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="size-9" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day">
        <ChevronLeft className="size-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="inline-flex h-9 min-w-[11.5rem] items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold transition-colors hover:bg-muted focus:outline-none">
          <span>{dayLabel(date)}</span>
          <CalendarIcon className="size-4 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <LazyCalendar
            mode="single"
            selected={ymdToDate(date)}
            disabled={{ after: ymdToDate(today) }}
            onSelect={(d) => {
              if (d) {
                setDate(format(d, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        onClick={() => setDate(shiftDay(date, 1))}
        disabled={atToday}
        aria-label="Next day"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

/** The status colour key, shown above the monthly matrix. */
export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {ATTENDANCE_STATUS_ORDER.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex size-4 items-center justify-center rounded text-[10px] font-semibold",
              ATTENDANCE_STATUS_META[s].cell,
            )}
          >
            {ATTENDANCE_STATUS_META[s].short}
          </span>
          {ATTENDANCE_STATUS_META[s].label}
        </span>
      ))}
    </div>
  );
}
