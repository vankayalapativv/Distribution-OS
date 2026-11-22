"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { usePagedTable } from "@/components/data-table/use-paged-table";
import { useTableUrlState } from "@/components/data-table/use-table-url-state";
import { type ActionConfig } from "@/lib/api-client";
import { USER_FILTER_KEYS, USER_SORT } from "./super-admin-list-logic";
import type { SuperAdminSetupUser } from "./super-admin-types";

const QUERY_KEY = "super-admin-users";

/** All the Users-list wiring: URL filter/sort state, the debounced search box,
 *  the paged table, and a `refresh()` that re-pulls the list after a mutation. */
export function useSuperAdminUsers(
  actionConfig: ActionConfig,
  columns: ColumnDef<SuperAdminSetupUser>[],
) {
  const url = useTableUrlState({ filterKeys: USER_FILTER_KEYS, defaultSort: USER_SORT });
  const { setFilter } = url;
  const filters = {
    search: url.filters.search,
    role: url.filters.role,
    status: url.filters.status,
  };
  const urlSearch = url.filters.search;
  const [search, setSearch] = useState(urlSearch);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== urlSearch) setFilter("search", search.trim());
    }, 350);
    return () => clearTimeout(t);
    // Depend on the search value + the stable members we use, not the whole `url`
    // object (recreated each render → the timer would re-arm every render).
  }, [search, urlSearch, setFilter]);

  const paged = usePagedTable<SuperAdminSetupUser>({
    actionConfig,
    queryKey: QUERY_KEY,
    path: "/super-admin/users/paged",
    rowsKey: "users",
    columns,
    initialSort: USER_SORT,
    filters,
    sorting: url.sorting,
    onSortingChange: url.setSorting,
    pagination: url.pagination,
    onPaginationChange: url.setPagination,
  });

  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });

  return { url, filters, search, setSearch, refresh, ...paged };
}
