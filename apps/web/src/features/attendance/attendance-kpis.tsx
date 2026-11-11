"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface KpiItem {
  label: string;
  /** Main figure. Use "—" when the metric can't be computed. */
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  /** Tailwind classes for the icon chip, e.g. "bg-primary/10 text-primary". */
  tone: string;
}

/** The headline stat tiles shared by the monthly and daily views. */
export function KpiRow({ items, isLoading }: Readonly<{ items: KpiItem[]; isLoading?: boolean }>) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{it.label}</span>
            <span className={cn("grid size-7 place-items-center rounded-lg [&>svg]:size-4", it.tone)}>
              {it.icon}
            </span>
          </div>
          <div className="mt-2.5 text-2xl font-semibold tabular-nums tracking-tight">{it.value}</div>
          {it.sub ? <div className="mt-1 text-xs text-muted-foreground">{it.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
