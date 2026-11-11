"use client";

import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function pickerRangeLabel(from?: Date, to?: Date): string {
  if (!from) return "Pick a date range";
  if (to) return `${format(from, "dd MMM")} – ${format(to, "dd MMM yyyy")}`;
  return format(from, "dd MMM yyyy");
}

/** Order-date range picker: a popover trigger showing the chosen range (or a
 *  placeholder) over a two-month range calendar. */
export function OrdersDateRangeFilter({
  dateRange,
  onDateRangeChange,
}: {
  readonly dateRange: DateRange | undefined;
  readonly onDateRangeChange: (value: DateRange | undefined) => void;
}) {
  return (
    <div className="w-[220px]">
      <Label className="text-xs text-muted-foreground mb-1.5 block">Date Range</Label>
      <Popover>
        <PopoverTrigger className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none">
          <span className={dateRange?.from ? "text-foreground" : ""}>
            {pickerRangeLabel(dateRange?.from, dateRange?.to)}
          </span>
          <CalendarIcon size={14} className="shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <LazyCalendar mode="range" selected={dateRange} onSelect={onDateRangeChange} numberOfMonths={2} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
