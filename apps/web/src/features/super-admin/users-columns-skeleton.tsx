import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";

/** Skeleton cells mirroring the user columns (User avatar+name · Contact ·
 *  Role · Status · Actions). */
export const userSkeleton: SkeletonCell[] = [
  () => (
    <div className="flex items-center gap-3">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <Skeleton className="h-4 w-32" />
    </div>
  ),
  () => (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="h-3 w-24" />
    </div>
  ),
  () => <Skeleton className="h-5 w-20 rounded-full" />,
  () => <Skeleton className="h-5 w-16 rounded-full" />,
  () => <Skeleton className="ml-auto size-7 rounded-md" />,
];
