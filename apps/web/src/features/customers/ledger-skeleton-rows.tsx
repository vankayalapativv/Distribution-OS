import { Skeleton } from "@/components/ui/skeleton";

/** A right-aligned skeleton bar for the numeric ledger columns. */
function RightBar({ w }: { readonly w: string }) {
  return (
    <div className="flex justify-end">
      <Skeleton className={`h-4 ${w}`} />
    </div>
  );
}

/** Context-aware loading skeleton whose cells mirror the ledger columns, shown
 *  in place of the rows while a new range loads (replaces a bare "Loading…"). */
export function LedgerSkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, r) => (
        <tr key={r} className="border-b border-border last:border-0">
          <td className="px-3 py-2.5"><Skeleton className="h-4 w-20" /></td>
          <td className="px-3 py-2.5"><Skeleton className="h-4 w-9" /></td>
          <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
          <td className="px-3 py-2.5"><Skeleton className="h-4 w-7" /></td>
          <td className="px-3 py-2.5"><Skeleton className="h-4 w-28" /></td>
          <td className="px-3 py-2.5"><RightBar w="w-16" /></td>
          <td className="px-3 py-2.5"><RightBar w="w-16" /></td>
          <td className="px-3 py-2.5"><RightBar w="w-20" /></td>
          <td className="px-3 py-2.5"><RightBar w="w-14" /></td>
          <td className="px-3 py-2.5"><RightBar w="w-4" /></td>
        </tr>
      ))}
    </>
  );
}
