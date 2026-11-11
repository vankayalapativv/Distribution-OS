"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePagedTable } from "@/components/data-table/use-paged-table";
import { useTableUrlState } from "@/components/data-table/use-table-url-state";
import { useSectionNotifications } from "@/features/shell/use-section-notifications";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { CustomerOption } from "@/features/customers/customer-search-select";
import { collectionColumns } from "./collections-columns";
import { COLLECTION_FILTER_KEYS, COLLECTION_SORT, parseYmd } from "./collections-list-logic";
import type { Collection } from "./collections-types";

/** All the Collections list wiring: URL filter/sort state, the debounced search
 *  box, the paged table, the pending-count badge, and section notifications. */
export function useCollectionsList(actionConfig: ActionConfig, customers: CustomerOption[]) {
  const queryClient = useQueryClient();
  const { newCount, highlightSince, acknowledge } = useSectionNotifications(actionConfig, "collections");

  const url = useTableUrlState({ filterKeys: COLLECTION_FILTER_KEYS, defaultSort: COLLECTION_SORT });
  const customerId = url.filters.customerId;
  const customerName = customers.find((c) => c.id === customerId)?.legalName ?? null;
  const statusFilter = url.filters.status || "all";
  const collectedBy = url.filters.collectedBy;
  const collectionDate = url.filters.date ? parseYmd(url.filters.date) : undefined;

  const [search, setSearch] = useState(url.filters.search);
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== url.filters.search) url.setFilter("search", search.trim());
    }, 350);
    return () => clearTimeout(t);
    // Depend on the actual search value + the stable setter, not the whole `url`
    // object (recreated each render → the timer would re-arm on every render).
  }, [search, url.filters.search, url.setFilter]);

  const paged = usePagedTable<Collection>({
    actionConfig,
    queryKey: "collections",
    path: "/collections/paged",
    rowsKey: "collections",
    columns: collectionColumns,
    initialSort: COLLECTION_SORT,
    filters: {
      status: url.filters.status, search: url.filters.search, customerId, collectedBy,
      fromDate: url.filters.date, toDate: url.filters.date, // single day → from == to
    },
    sorting: url.sorting,
    onSortingChange: url.setSorting,
    pagination: url.pagination,
    onPaginationChange: url.setPagination,
  });

  const pendingQuery = useQuery({
    queryKey: ["collections", "pending-count"],
    queryFn: () => apiGet<{ total: number }>(actionConfig, "/collections/paged?status=pending&pageSize=1"),
  });

  return {
    url, queryClient, search, setSearch, statusFilter, collectedBy, customerId, customerName, collectionDate,
    pendingCount: pendingQuery.data?.total ?? 0,
    newCount, highlightSince, acknowledge, hasFilters: url.hasFilters, ...paged,
  };
}
