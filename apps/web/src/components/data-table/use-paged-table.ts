"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { apiRequest, type ActionConfig } from "@/lib/api-client";

interface UsePagedTableOptions<T> {
  actionConfig: ActionConfig;
  /** Stable prefix for the query key, e.g. "customers". */
  queryKey: string;
  /** Paged endpoint path, e.g. "/customers/paged". */
  path: string;
  /** Key holding the row array in the `{ <rowsKey>, total }` response. */
  rowsKey: string;
  columns: ColumnDef<T>[];
  initialSort: SortingState;
  /** Applied filter params (search, from, to, status…). Page resets when these change. */
  filters?: Record<string, string>;
  pageSize?: number;
  /** Controlled sort/pagination (e.g. from `useTableUrlState`). When both are
   *  supplied the hook is fully controlled and skips its internal page-reset —
   *  the owner is responsible for resetting the page on filter change. Omit both
   *  to keep the original self-managed behaviour. */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
}

/**
 * Returns true only once `active` has stayed true continuously for `delayMs`.
 * Used to defer the loading shimmer on refetch (page / filter / sort change) so
 * fast responses keep the previous rows and only slow ones flip to the skeleton.
 * State is only set from a timer and cleanup — never synchronously in the effect.
 */
function useDelayedTrue(active: boolean, delayMs: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setOn(true), delayMs);
    return () => {
      clearTimeout(timer);
      setOn(false);
    };
  }, [active, delayMs]);
  return on;
}

/**
 * The server-paged table pattern (TanStack Query + Table) shared by every list
 * view: manages sort + pagination, builds `?q=&sort=&dir=&page=&pageSize=`, and
 * returns a ready TanStack `table` plus load state. Sort/paginate stay server-side.
 */
export function usePagedTable<T>(opts: UsePagedTableOptions<T>) {
  const pageSize = opts.pageSize ?? 8;
  // Fully controlled when both sort + pagination are supplied (URL-driven lists);
  // otherwise the hook manages them internally (original behaviour).
  const controlled = opts.sorting !== undefined && opts.pagination !== undefined;
  const [sortingInternal, setSortingInternal] = useState<SortingState>(opts.initialSort);
  const [paginationInternal, setPaginationInternal] = useState({ pageIndex: 0, pageSize });
  const sorting = opts.sorting ?? sortingInternal;
  const setSorting = opts.onSortingChange ?? setSortingInternal;
  const pagination = opts.pagination ?? paginationInternal;
  const setPagination = opts.onPaginationChange ?? setPaginationInternal;

  // Reset to page 1 when the applied filters change — the React-blessed
  // "adjust state during render on change" pattern (not an effect). Skipped when
  // controlled: the URL owner already drops `page` on every filter change.
  const filterKey = JSON.stringify(opts.filters ?? {});
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    if (!controlled) setPaginationInternal((p) => ({ ...p, pageIndex: 0 }));
  }

  const sort = sorting[0];
  const query = useQuery({
    queryKey: [
      opts.queryKey,
      opts.filters ?? {},
      sort?.id,
      sort?.desc,
      pagination.pageIndex,
      pagination.pageSize,
    ],
    queryFn: () => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.filters ?? {})) if (v) sp.set(k, v);
      if (sort) {
        sp.set("sort", sort.id);
        sp.set("dir", sort.desc ? "desc" : "asc");
      }
      sp.set("page", String(pagination.pageIndex + 1));
      sp.set("pageSize", String(pagination.pageSize));
      return apiRequest<Record<string, unknown>>(
        opts.actionConfig,
        "GET",
        `${opts.path}?${sp.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });

  const rows = (query.data?.[opts.rowsKey] as T[] | undefined) ?? [];
  const total = (query.data?.total as number | undefined) ?? 0;

  // Loading shimmer policy: show it immediately on the first load, and on a
  // refetch (page / filter / sort) only once the fetch has run past ~200ms — so
  // fast pages keep their rows (no flash) while slow ones surface the skeleton.
  const slowRefetch = useDelayedTrue(query.isFetching && !query.isLoading, 200);
  const showSkeleton = query.isLoading || slowRefetch;

  const table = useReactTable({
    data: rows,
    columns: opts.columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  return {
    table,
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
    pageSize: pagination.pageSize,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    /** Drives the table skeleton: first load, or a refetch slower than ~200ms. */
    showSkeleton,
    error: (query.error as Error | null) ?? null,
  };
}
