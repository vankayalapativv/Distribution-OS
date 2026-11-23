import { Skeleton } from "@/components/ui/skeleton";

/** One shimmer row mirroring the customer list row (avatar · name/code/owner ·
 *  record count). Used by the route-level loading UI. */
export function ReassignListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-l-[3px] border-border border-l-transparent px-4 py-3 last:border-b-0">
      <Skeleton className="size-8 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-1 text-right">
        <Skeleton className="ml-auto h-4 w-7" />
        <Skeleton className="ml-auto h-2.5 w-10" />
      </div>
    </div>
  );
}
