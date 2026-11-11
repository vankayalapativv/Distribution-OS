import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";

/** Skeleton cells mirroring the collection columns (Amount cell right-aligned). */
export const collectionSkeleton: SkeletonCell[] = [
  () => <Skeleton className="h-3 w-16" />,
  () => (
    <>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-1.5 h-3 w-24" />
    </>
  ),
  () => <Skeleton className="h-4 w-24" />,
  () => <Skeleton className="h-4 w-16" />,
  () => <Skeleton className="h-4 w-20" />,
  () => (
    <div className="flex justify-end">
      <Skeleton className="h-4 w-20" />
    </div>
  ),
  () => <Skeleton className="h-4 w-24" />,
  () => <Skeleton className="h-5 w-20 rounded-full" />,
];
