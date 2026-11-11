"use client";

import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { WEEKDAYS } from "./beat-plans-api";

/** One shimmering day column: real day header + count pill + card-shaped rows +
 *  the Add footer — mirrors the live BeatColumn so the load reads as the board. */
function DayColumnSkeleton({ title, dow }: { readonly title: string; readonly dow: string }) {
  return (
    <div className="flex h-full min-h-0 w-[288px] shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">{title}</span>
          <span className="text-[10px] font-medium text-muted-foreground">{dow}</span>
        </div>
        <Skeleton className="h-5 w-6 rounded-full" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-border bg-card p-2"
          >
            <Skeleton className="mt-0.5 size-[18px] rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-2.5 w-3/5" />
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border p-2.5">
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Loading board: the Unassigned pool stays a plain (non-shimmering) shell; only
 *  the six day columns shimmer while the selected executive's plan is fetched. */
export function BeatBoardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-3.5 overflow-x-hidden pb-3">
      <div className="flex h-full min-h-0 w-[288px] shrink-0 flex-col rounded-xl border border-border bg-muted">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Unassigned
          </span>
        </header>
        <div className="shrink-0 px-2.5 pt-2.5">
          <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground">
            <Search className="size-3.5" />
            Search name, phone, city…
          </div>
        </div>
      </div>
      {WEEKDAYS.map((d) => (
        <DayColumnSkeleton key={d.value} title={d.full} dow={d.label} />
      ))}
    </div>
  );
}
