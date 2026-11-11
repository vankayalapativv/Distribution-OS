"use client";

import { flexRender, type Row, type Table as TanTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { memo, useCallback, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "./pagination-bar";

/** A skeleton cell is a render fn (kept as fns to satisfy react/jsx-key). */
export type SkeletonCell = () => ReactNode;

/** Optional per-column display hints, read off `columnDef.meta`. */
export interface ColumnMeta {
  className?: string;
}

function metaClass(def: { meta?: unknown }): string | undefined {
  return (def.meta as ColumnMeta | undefined)?.className;
}

/**
 * One table row, memoized. TanStack keeps a row's object reference stable across
 * renders while its data is unchanged, so with a precomputed `className` and a
 * stable `onRowClick`, shallow-prop memo skips re-rendering rows that didn't
 * change when the parent re-renders for an unrelated reason (e.g. a sidebar badge
 * poll, a filter dropdown opening). Worst case — an unstable `onRowClick` — it
 * re-renders exactly as before, so this is a safe, no-downside optimization.
 */
function DataTableRowInner<T>({
  row,
  onRowClick,
  className,
}: {
  readonly row: Row<T>;
  readonly onRowClick?: (row: T) => void;
  readonly className?: string;
}) {
  const handleClick = useCallback(() => onRowClick?.(row.original), [onRowClick, row]);
  return (
    <TableRow onClick={onRowClick ? handleClick : undefined} className={className}>
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className={metaClass(cell.column.columnDef)}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}
// memo() erases the generic; cast restores the <T> call signature.
const DataTableRow = memo(DataTableRowInner) as typeof DataTableRowInner;

interface DataTableProps<T> {
  readonly table: TanTable<T>;
  readonly columnCount: number;
  readonly isLoading: boolean;
  /** One render fn per column, shaped like that column's cell. */
  readonly skeleton: SkeletonCell[];
  readonly pageSize: number;
  readonly pageCount: number;
  /** Content shown when there are no rows (message + optional action). */
  readonly empty: ReactNode;
  readonly onRowClick?: (row: T) => void;
  /** Extra classes on the <table> (e.g. "table-fixed" for equal-width columns). */
  readonly tableClassName?: string;
  /** Optional per-row classes (e.g. highlight newly-arrived rows). */
  readonly rowClassName?: (row: T) => string | undefined;
}

/** Visual table (sortable headers + context-aware skeleton + empty state) plus a pagination bar. */
export function DataTable<T>({
  table,
  columnCount,
  isLoading,
  skeleton,
  pageSize,
  pageCount,
  empty,
  onRowClick,
  tableClassName,
  rowClassName,
}: DataTableProps<T>) {
  const rows = table.getRowModel().rows;

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {/* `min-w-max` keeps columns at their natural width so on narrow screens
            the table scrolls horizontally (base Table wraps it in overflow-x-auto)
            instead of crushing columns into each other. */}
        <Table className={`min-w-max ${tableClassName ?? ""}`.trim()}>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-slate-50 hover:bg-slate-50">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={`${metaClass(header.column.columnDef) ?? ""} ${canSort ? "cursor-pointer select-none" : ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort &&
                          (() => { if (sorted === "asc") return (
                            <ArrowUp size={12} />
                          ); if (sorted === "desc") return (
                            <ArrowDown size={12} />
                          ); return (
                            <ArrowUpDown size={12} className="opacity-40" />
                          ); })()}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {(() => { if (isLoading) return (
              Array.from({ length: pageSize }, (_, r) => `sk-row-${r}`).map((rowKey) => (
                <TableRow key={rowKey} className="hover:bg-transparent">
                  {skeleton.map((cell, i) => ({ cell, key: `${rowKey}-c${i}` })).map(({ cell, key }) => (
                    <TableCell key={key}>{cell()}</TableCell>
                  ))}
                </TableRow>
              ))
            ); if (rows.length === 0) return (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-16 text-center text-sm text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            ); return (
              rows.map((row) => (
                <DataTableRow
                  key={row.id}
                  row={row}
                  onRowClick={onRowClick}
                  className={
                    `${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(row.original) ?? ""}`.trim() ||
                    undefined
                  }
                />
              ))
            ); })()}
          </TableBody>
        </Table>
      </div>

      <PaginationBar table={table} pageCount={pageCount} />
    </>
  );
}
