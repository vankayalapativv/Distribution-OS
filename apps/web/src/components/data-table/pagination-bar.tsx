"use client";

import type { Table as TanTable } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

/** "Page X of Y" + Prev/Next controls for a manually-paginated TanStack table. */
export function PaginationBar<T>({
  table,
  pageCount,
}: {
  readonly table: TanTable<T>;
  readonly pageCount: number;
}) {
  const pageIndex = table.getState().pagination.pageIndex;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span className="tabular-nums">
        Page {pageIndex + 1} of {pageCount}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
