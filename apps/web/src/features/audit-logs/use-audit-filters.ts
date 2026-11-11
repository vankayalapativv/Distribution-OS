"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import type { SortingState } from "@tanstack/react-table";
import { useTableUrlState } from "@/components/data-table/use-table-url-state";

const FILTER_KEYS = ["q", "actorId", "entityType", "action", "from", "to"] as const;
export const AUDIT_SORT: SortingState = [{ id: "createdAt", desc: true }];

const parseDate = (s: string): Date | undefined => (s ? new Date(`${s}T00:00:00`) : undefined);

/** All audit-log filters + sort + page, mirrored in the URL so Back/refresh/share
 *  restore the exact filtered view. Search is debounced into the URL. */
export function useAuditFilters() {
  const url = useTableUrlState({ filterKeys: FILTER_KEYS, defaultSort: AUDIT_SORT });
  const appliedSearch = url.filters.q;
  const actorId = url.filters.actorId;
  const entityType = url.filters.entityType;
  const action = url.filters.action;
  const fromDate = url.filters.from;
  const rawTo = url.filters.to;
  const toDate = rawTo || fromDate; // single-day picks send to = from server-side
  const [search, setSearch] = useState(appliedSearch);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== url.filters.q) url.setFilter("q", search.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [search, url]);

  const dateRange: DateRange | undefined = fromDate
    ? { from: parseDate(fromDate), to: parseDate(rawTo) }
    : undefined;

  const setDateRange = (sel: DateRange | undefined) => {
    if (sel?.from) url.setFilters({ from: format(sel.from, "yyyy-MM-dd"), to: sel.to ? format(sel.to, "yyyy-MM-dd") : "" });
    else url.setFilters({ from: "", to: "" });
  };

  const hasFilters = !!appliedSearch || !!actorId || !!entityType || !!action || !!fromDate;

  let dateLabel = "Any date";
  if (fromDate) {
    dateLabel = rawTo
      ? `${format(parseDate(fromDate)!, "dd MMM")} – ${format(parseDate(rawTo)!, "dd MMM yyyy")}`
      : format(parseDate(fromDate)!, "dd MMM yyyy");
  }

  const reset = () => {
    setSearch("");
    url.clearFilters();
  };

  const serverFilters = { q: appliedSearch, actorId, entityType, action, fromDate, toDate };

  return {
    search, setSearch,
    actorId, setActorId: (v: string) => url.setFilter("actorId", v),
    entityType, setEntityType: (v: string) => url.setFilter("entityType", v),
    action, setAction: (v: string) => url.setFilter("action", v),
    dateRange, setDateRange, fromDate, toDate, hasFilters, dateLabel, reset, serverFilters,
    sorting: url.sorting, setSorting: url.setSorting, pagination: url.pagination, setPagination: url.setPagination,
  };
}

export type AuditFiltersState = ReturnType<typeof useAuditFilters>;
