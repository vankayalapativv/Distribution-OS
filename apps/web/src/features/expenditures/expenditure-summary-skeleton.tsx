"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Context-aware shimmer for the expenditure summary panel — mirrors the real
 * layout: four stat cards + the "Breakdown by category" card, whose chart is now
 * a treemap, so the placeholder is a treemap-shaped tile grid (not a donut).
 */
export function ExpenditureSummarySkeleton() {
  return (
    <div className="space-y-4">
      {/* Four stat cards — same frame + label/value/hint stack as ExpenditureSummaryCards. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-white p-4">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="mt-2 h-5 w-28 rounded" />
            <Skeleton className="mt-1.5 h-3 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Breakdown card — header (title + subtitle) over a treemap-shaped tile grid. */}
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="border-b border-border px-4 py-2.5">
          <Skeleton className="h-4 w-44 rounded" />
          <Skeleton className="mt-1.5 h-3 w-72 max-w-[80%] rounded" />
        </div>
        <div className="p-4">
          {/* Treemap placeholder: one dominant tile + a column of medium tiles +
              a column of smaller ones, echoing the real tile proportions. */}
          <div className="flex gap-1.5" style={{ height: 300 }}>
            <Skeleton className="flex-[5] rounded-[4px]" />
            <div className="flex flex-[4] flex-col gap-1.5">
              <Skeleton className="flex-[2] rounded-[4px]" />
              <div className="flex flex-1 gap-1.5">
                <Skeleton className="flex-1 rounded-[4px]" />
                <Skeleton className="flex-1 rounded-[4px]" />
              </div>
            </div>
            <div className="flex flex-[3] flex-col gap-1.5">
              <Skeleton className="flex-1 rounded-[4px]" />
              <Skeleton className="flex-1 rounded-[4px]" />
              <Skeleton className="flex-1 rounded-[4px]" />
            </div>
          </div>
          {/* Colour-key line (Compulsory / Variable). */}
          <div className="mt-3 flex justify-center gap-4">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
