import { Skeleton } from "@/components/ui/skeleton";

/** Context-aware shimmer for the expense dialogs — mirrors a list of rows, each a
 *  title + subtitle on the left and an action button on the right. */
export function PanelRowsSkeleton({ rows = 3 }: { readonly rows?: number }) {
  return (
    <ul className="space-y-2" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </li>
      ))}
    </ul>
  );
}
