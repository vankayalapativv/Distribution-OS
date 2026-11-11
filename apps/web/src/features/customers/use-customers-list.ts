"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePagedTable } from "@/components/data-table/use-paged-table";
import { useTableUrlState } from "@/components/data-table/use-table-url-state";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { customerColumns } from "./customers-columns";
import { useCustomersDownload } from "./use-customers-download";
import { CUSTOMER_FILTER_KEYS, CUSTOMER_SORT } from "./customers-list-logic";
import type { Customer } from "./customers-api";

interface FilterOptions {
  cities: string[];
  salesExecutives: { id: string; name: string }[];
}

/** All the list wiring: URL filter/sort state, the debounced search box, the
 *  filter-options query, the paged table, and the PDF download. */
export function useCustomersList(actionConfig: ActionConfig) {
  const url = useTableUrlState({ filterKeys: CUSTOMER_FILTER_KEYS, defaultSort: CUSTOMER_SORT });
  const filters = {
    search: url.filters.search,
    city: url.filters.city,
    salesExecutiveId: url.filters.salesExecutiveId,
    dues: url.filters.dues,
  };
  const [search, setSearch] = useState(url.filters.search);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== url.filters.search) url.setFilter("search", search.trim());
    }, 350);
    return () => clearTimeout(t);
    // Depend on the actual search value + the stable setter, not the whole `url`
    // object (recreated each render → the timer would re-arm on every render).
  }, [search, url.filters.search, url.setFilter]);

  const options = useQuery({
    queryKey: ["customer-filter-options"],
    queryFn: () => apiGet<FilterOptions>(actionConfig, "/customers/filter-options"),
  });
  const salesExecutives = options.data?.salesExecutives ?? [];

  const paged = usePagedTable<Customer>({
    actionConfig,
    queryKey: "customers",
    path: "/customers/paged",
    rowsKey: "customers",
    columns: customerColumns,
    initialSort: CUSTOMER_SORT,
    filters,
    sorting: url.sorting,
    onSortingChange: url.setSorting,
    pagination: url.pagination,
    onPaginationChange: url.setPagination,
  });

  const download = useCustomersDownload(actionConfig, filters, salesExecutives);

  return { url, filters, search, setSearch, cities: options.data?.cities ?? [], salesExecutives, ...paged, ...download };
}
