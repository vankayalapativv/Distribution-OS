"use client";

import { Button } from "@/components/ui/button";
import { plural } from "@/lib/format";

/** Page-header subtitle: total count + a "N pending" badge. */
export function CollectionsSubtitle({ total, isLoading, pendingCount }: { readonly total: number; readonly isLoading: boolean; readonly pendingCount: number }) {
  return (
    <>
      {isLoading ? "Loading…" : `${total} collection${plural(total)}`}
      {pendingCount > 0 && (
        <span className="ml-2 inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-yellow-600/20">
          {pendingCount} pending
        </span>
      )}
    </>
  );
}

/** Empty-table content — differs when filters are active vs a truly empty list. */
export function CollectionsEmpty({ hasFilters, canCreate, onCreate }: { readonly hasFilters: boolean; readonly canCreate: boolean; readonly onCreate: () => void }) {
  if (hasFilters) return <>No collections match your filters.</>;
  return (
    <>
      No collections recorded yet.
      {canCreate && (
        <span className="mt-4 block">
          <Button variant="outline" onClick={onCreate}>Record first collection</Button>
        </span>
      )}
    </>
  );
}
