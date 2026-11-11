import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";

/** Skeleton cells mirroring the expenditure columns (Amount + actions right-aligned). */
export const expenditureSkeleton: SkeletonCell[] = [
  () => <Skeleton className="h-3 w-16" />,
  () => <Skeleton className="h-4 w-24" />,
  () => (
    <div className="space-y-1">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-20" />
    </div>
  ),
  () => <Skeleton className="h-5 w-20 rounded-full" />,
  () => <Skeleton className="h-4 w-24" />,
  () => <Skeleton className="h-4 w-16" />,
  () => (
    <div className="flex justify-end">
      <Skeleton className="h-4 w-20" />
    </div>
  ),
  () => (
    <div className="flex justify-end gap-1">
      <Skeleton className="h-6 w-6 rounded" />
      <Skeleton className="h-6 w-6 rounded" />
    </div>
  ),
];
