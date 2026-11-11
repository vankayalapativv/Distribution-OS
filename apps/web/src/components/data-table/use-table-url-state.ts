"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OnChangeFn, PaginationState, SortingState } from "@tanstack/react-table";

interface TableUrlStateConfig {
  /** URL param names for this list's filters, e.g. ["search","city"]. Pass a
   *  module-level constant so the reference stays stable across renders. */
  filterKeys: readonly string[];
  /** Sort used when the URL carries none. */
  defaultSort: SortingState;
  pageSize?: number;
}

export interface TableUrlState {
  /** Current filter values, keyed by `filterKeys` ("" when absent). */
  filters: Record<string, string>;
  /** Set/clear one filter; always returns to page 1. */
  setFilter: (key: string, value: string) => void;
  /** Set/clear several filters in ONE history write (for an "Apply" button);
   *  returns to page 1. Only the keys in `patch` change. */
  setFilters: (patch: Record<string, string>) => void;
  /** Drop every filter (and page); keeps sort. */
  clearFilters: () => void;
  /** True when any filter is active. */
  hasFilters: boolean;
  sorting: SortingState;
  setSorting: OnChangeFn<SortingState>;
  pagination: PaginationState;
  setPagination: OnChangeFn<PaginationState>;
}

/**
 * Mirrors a list view's filters + sort + page into the URL query string, so the
 * view survives navigation: filtering, then clicking a row and pressing Back,
 * restores the exact filtered/sorted/paged screen (and the URL is shareable +
 * refresh-safe). Writes use `router.replace({ scroll: false })` so filtering and
 * paging never pollute history — only the row-click `push` adds a Back target.
 *
 * Pair it with `usePagedTable` by forwarding `sorting`/`setSorting` +
 * `pagination`/`setPagination` as its controlled state.
 */
export function useTableUrlState(config: TableUrlStateConfig): TableUrlState {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pageSize = config.pageSize ?? 8;
  const spString = searchParams.toString();

  const filters = useMemo(() => {
    const sp = new URLSearchParams(spString);
    const out: Record<string, string> = {};
    for (const k of config.filterKeys) out[k] = sp.get(k) ?? "";
    return out;
  }, [spString, config.filterKeys]);

  const hasFilters = config.filterKeys.some((k) => filters[k]);

  const { sorting, pagination } = useMemo(() => {
    const sp = new URLSearchParams(spString);
    const sortId = sp.get("sort");
    const sort: SortingState = sortId
      ? [{ id: sortId, desc: sp.get("dir") !== "asc" }]
      : config.defaultSort;
    const pageParam = Math.floor(Number(sp.get("page")));
    const pageIndex = Number.isFinite(pageParam) && pageParam > 1 ? pageParam - 1 : 0;
    return { sorting: sort, pagination: { pageIndex, pageSize } };
  }, [spString, config.defaultSort, pageSize]);

  const write = useCallback(
    (mutate: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(spString);
      mutate(sp);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [spString, pathname, router],
  );

  const setFilter = useCallback(
    (key: string, value: string) =>
      write((sp) => {
        if (value) sp.set(key, value);
        else sp.delete(key);
        sp.delete("page"); // any filter change returns to page 1
      }),
    [write],
  );

  const setFilters = useCallback(
    (patch: Record<string, string>) =>
      write((sp) => {
        for (const [k, v] of Object.entries(patch)) {
          if (v) sp.set(k, v);
          else sp.delete(k);
        }
        sp.delete("page");
      }),
    [write],
  );

  const clearFilters = useCallback(
    () =>
      write((sp) => {
        for (const k of config.filterKeys) sp.delete(k);
        sp.delete("page");
      }),
    [write, config.filterKeys],
  );

  const setSorting: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      write((sp) => {
        const s = next[0];
        if (s) {
          sp.set("sort", s.id);
          sp.set("dir", s.desc ? "desc" : "asc");
        } else {
          sp.delete("sort");
          sp.delete("dir");
        }
        sp.delete("page"); // re-sorting returns to page 1
      });
    },
    [write, sorting],
  );

  const setPagination: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      write((sp) => {
        if (next.pageIndex > 0) sp.set("page", String(next.pageIndex + 1));
        else sp.delete("page");
      });
    },
    [write, pagination],
  );

  return { filters, setFilter, setFilters, clearFilters, hasFilters, sorting, setSorting, pagination, setPagination };
}
