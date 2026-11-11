import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

/**
 * Suspense fallback for the saved-simulation ROWS only (goes inside <TableBody>).
 * The search box, New-simulation button and table header are rendered eagerly by
 * MarginSimulatorContent — only these rows shimmer while the data loads.
 */
export function MarginRowsSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, r) => (
        <TableRow key={r}>
          <TableCell className="py-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1.5 h-3 w-12" />
          </TableCell>
          {Array.from({ length: 6 }).map((_, c) => (
            <TableCell key={c} className="border-l border-border text-center">
              <Skeleton className="mx-auto h-4 w-12" />
            </TableCell>
          ))}
          <TableCell className="border-l border-border text-center">
            <Skeleton className="mx-auto h-4 w-14" />
          </TableCell>
          <TableCell className="border-l border-border text-center">
            <Skeleton className="mx-auto h-4 w-16" />
          </TableCell>
          <TableCell className="border-l border-border text-center">
            <Skeleton className="mx-auto size-6 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
