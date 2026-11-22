"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { OIL_SEGMENTS } from "./targets-api";

/**
 * Context-aware loading shimmer for the Targets panel — mirrors a `TargetsExecRow`:
 * the name + action button on the left, and the 8-segment bar grid + oil-total
 * line on the right, in the same divided-row frame. Reads as the real layout
 * loading, not a generic block.
 */
export function TargetsExecSkeleton({ rows = 3 }: { readonly rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
          {/* Left: name + Set/Edit button. */}
          <div className="w-40 shrink-0 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
          {/* Right: the per-segment bar grid + oil-total line. */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 lg:grid-cols-4">
              {OIL_SEGMENTS.map((segment) => (
                <div key={segment} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
