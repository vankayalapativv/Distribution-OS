"use client";

import { Skeleton } from "@/components/ui/skeleton";

const TAB_LABELS = ["Details", "Orders", "Ledger", "Notes", "Visits", "Photos"];

/** Mirrors one section card in the Details tab (title + 2-col field grid). */
function InfoCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-white px-5 py-3 shadow-sm">
      <Skeleton className="mb-3 h-3 w-24" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the customer detail body (header → tab bar → Details
 * cards). The tab labels are rendered as REAL static text — they never come
 * from the server — so only the header and the fetched content shimmer. Shared
 * by the route-level loading.tsx and the client loader's cache-miss state so
 * the two always match. Callers wrap this in the dashboard shell.
 */
export function CustomerDetailBodySkeleton() {
  return (
    <>
      {/* Header: breadcrumb, title, status/exec/code, actions */}
      <div>
        <Skeleton className="h-3 w-52" />
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-64" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      </div>

      {/* Tab bar — static labels (mirrors CustomerDetailTabBar), first active. */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-border">
        {TAB_LABELS.map((label, i) => (
          <span
            key={label}
            className={`relative whitespace-nowrap px-4 pb-3.5 pt-3 text-sm font-semibold ${
              i === 0 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {label}
            {i === 0 ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-t bg-primary" /> : null}
          </span>
        ))}
      </div>

      {/* Details content — 5 stacked info cards in a 2-column grid */}
      <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-2 md:items-start">
        {Array.from({ length: 5 }).map((_, i) => (
          <InfoCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}
