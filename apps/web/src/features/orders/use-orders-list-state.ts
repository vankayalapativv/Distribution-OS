"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { SortingState } from "@tanstack/react-table";
import { useTableUrlState } from "@/components/data-table/use-table-url-state";
import { parseYmd } from "./orders-list-helpers";
import type { CustomerOption } from "@/features/customers/customer-search-select";

// URL param names (also the API's filter param names) + default sort. Module
// scope keeps the reference stable for useTableUrlState.
export const ORDER_FILTER_KEYS = [
  "search",
  "customerId",
  "city",
  "salesExecutiveId",
  "dateFrom",
  "dateTo",
  "fulfillment",
] as const;
export const ORDER_SORT: SortingState = [{ id: "orderDate", desc: true }];

/** URL-backed filter/search state for the orders list: the URL is the source of
 *  truth (Back/refresh/deep-links restore the exact view). The search box is
 *  debounced into the URL; every other filter applies instantly. */
export function useOrdersListState(customers: CustomerOption[]) {
  const url = useTableUrlState({ filterKeys: ORDER_FILTER_KEYS, defaultSort: ORDER_SORT });
  const applied = url.filters;
  const [search, setSearch] = useState(applied.search);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== applied.search) url.setFilter("search", search.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [search, applied.search, url]);

  const cities = Array.from(
    new Set(customers.map((c) => c.addressCity).filter((v): v is string => !!v)),
  ).sort((a, b) => a.localeCompare(b));
  const appliedCustomerName = applied.customerId
    ? (customers.find((c) => c.id === applied.customerId)?.legalName ?? "Customer")
    : "";
  const dateRange: DateRange | undefined = applied.dateFrom
    ? { from: parseYmd(applied.dateFrom), to: applied.dateTo ? parseYmd(applied.dateTo) : undefined }
    : undefined;
  const hasActiveFilters = !!(
    applied.search ||
    applied.customerId ||
    applied.city ||
    applied.salesExecutiveId ||
    applied.dateFrom ||
    applied.fulfillment
  );

  const setDateRange = (range: DateRange | undefined) =>
    url.setFilters({
      dateFrom: range?.from ? format(range.from, "yyyy-MM-dd") : "",
      dateTo: range?.to ? format(range.to, "yyyy-MM-dd") : "",
    });
  const clearFilters = () => {
    setSearch("");
    url.clearFilters();
  };

  return {
    url,
    applied,
    search,
    setSearch,
    cities,
    appliedCustomerName,
    dateRange,
    hasActiveFilters,
    setDateRange,
    clearFilters,
  };
}
