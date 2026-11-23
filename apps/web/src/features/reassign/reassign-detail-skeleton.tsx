import { Skeleton } from "@/components/ui/skeleton";

/** Context-aware skeleton for the reassign detail — mirrors the customer header,
 *  the current-owner → reassign-to block, and the "what moves" grid while the
 *  selected customer's preview loads. */
export function ReassignDetailSkeleton() {
  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* header: avatar + name/code + count pill */}
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* move ownership: owner card → arrow → reassign-to card */}
      <Skeleton className="h-3 w-28" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <Skeleton className="h-[72px] rounded-xl" />
        <Skeleton className="mx-auto size-9 rounded-full sm:mx-0" />
        <Skeleton className="h-[72px] rounded-xl" />
      </div>

      {/* what-moves grid (7 tiles) */}
      <Skeleton className="h-3 w-28" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-12 rounded-xl" />
    </section>
  );
}
