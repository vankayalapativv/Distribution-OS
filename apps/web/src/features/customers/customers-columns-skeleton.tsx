import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";

/** Skeleton cells mirroring the customer columns (Code · Name+meta · Oldest unpaid
 *  · Collection Dues · Status). */
export const customerSkeleton: SkeletonCell[] = [
  () => <Skeleton className="h-3 w-16" />,
  () => (
    <div className="flex flex-col gap-1.5">
      {/* Name + two segment-icon glyphs */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3.5 w-3.5 rounded-sm" />
        <Skeleton className="h-3.5 w-3.5 rounded-sm" />
      </div>
      <Skeleton className="h-3 w-44" /> {/* City · Executive · Type */}
      <Skeleton className="h-3 w-28" /> {/* Phone */}
    </div>
  ),
  () => <Skeleton className="h-4 w-24" />,
  () => <Skeleton className="h-4 w-20" />,
  () => <Skeleton className="h-5 w-16 rounded-full" />,
];
