"use client";

import { Calendar as CalendarIcon, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VIEW_CONFIG, VIEW_ORDER, type View } from "./logistics-views";

function toolbarRangeLabel(from?: Date, to?: Date): string {
  if (!from) return "Pick a date range";
  if (to) return `${format(from, "dd MMM")} – ${format(to, "dd MMM yyyy")}`;
  return format(from, "dd MMM yyyy");
}

/** View toggle + search-as-you-type box + date-range picker + clear/refresh + count. */
export function LogisticsToolbar({
  view,
  setView,
  qInput,
  setQInput,
  dateRange,
  setDateRange,
  onClear,
  onRefresh,
  isFetching,
  isLoading,
  total,
}: {
  readonly view: View;
  readonly setView: (view: View) => void;
  readonly qInput: string;
  readonly setQInput: (q: string) => void;
  readonly dateRange: DateRange | undefined;
  readonly setDateRange: (range: DateRange | undefined) => void;
  readonly onClear: () => void;
  readonly onRefresh: () => void;
  readonly isFetching: boolean;
  readonly isLoading: boolean;
  readonly total: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="inline-flex rounded-lg border border-border bg-slate-100 p-0.5">
        {VIEW_ORDER.map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-semibold ${view === v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {VIEW_CONFIG[v].label}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
        <Input value={qInput} onChange={(e) => setQInput(e.target.value)}
          placeholder={VIEW_CONFIG[view].searchPlaceholder} className="h-9 w-56 pl-8" />
      </div>
      <Popover>
        <PopoverTrigger className="flex h-9 w-56 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none">
          <span className={dateRange?.from ? "text-foreground" : ""}>
            {toolbarRangeLabel(dateRange?.from, dateRange?.to)}
          </span>
          <CalendarIcon size={14} className="shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <LazyCalendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} autoFocus />
        </PopoverContent>
      </Popover>
      <Button variant="outline" onClick={onClear} className="h-9">Clear</Button>
      <Button variant="ghost" size="icon" onClick={onRefresh} className="h-9 w-9" title="Refresh"><RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /></Button>
      <div className="ml-auto text-xs text-muted-foreground">
        {isLoading ? "Loading…" : `${total} ${VIEW_CONFIG[view].noun}`}
      </div>
    </div>
  );
}
