"use client";

import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PeriodToggle } from "./period-toggle";
import type { TargetsPanelState } from "./use-targets-panel";

/** The panel's top bar: period nav + jump calendar + status badge + paste-to-all + toggle. */
export function TargetsPanelHeader({ p }: { readonly p: TargetsPanelState }) {
  const [jumpOpen, setJumpOpen] = useState(false);
  const showPasteAll = p.canEdit && !!p.clipboard && p.executives.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-8" onClick={() => p.step(-1)} aria-label="Previous period">
          <ChevronLeft className="size-4" />
        </Button>
        <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
          <PopoverTrigger className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none">
            <CalendarIcon className="size-3.5 opacity-60" />
            {p.label}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <LazyCalendar mode="single" selected={p.selectedStart} onSelect={(d) => { if (d) p.jumpTo(d); setJumpOpen(false); }} defaultMonth={p.selectedStart} />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" className="size-8" onClick={() => p.step(1)} aria-label="Next period">
          <ChevronRight className="size-4" />
        </Button>
        {(() => { if (p.isFuture) return (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-600/20">Upcoming</span>
        ); if (p.isPast) return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-500/20">Past</span>
        ); return (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current</span>
        ); })()}
        {!p.isCurrent ? (
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={p.goToCurrent}>
            {p.period === "week" ? "This week" : "This month"}
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {showPasteAll ? (
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => { p.setBulkError(null); p.setConfirmAll(true); }}>
            <ClipboardPaste className="size-3.5" /> Paste to all
          </Button>
        ) : null}
        <PeriodToggle period={p.period} onChange={p.changePeriod} />
      </div>
    </div>
  );
}
