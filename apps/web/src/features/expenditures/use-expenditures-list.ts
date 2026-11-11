"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { usePagedTable } from "@/components/data-table/use-paged-table";
import { useTableUrlState } from "@/components/data-table/use-table-url-state";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { buildExpenditureColumns } from "./expenditures-columns";
import type { Expenditure, ExpenditureCategory } from "./expenditures-api";

/** Default range: the current month, in IST-ish local terms. */
function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const FILTER_KEYS = ["from", "to", "type", "categoryId", "q"] as const;
const DEFAULT_SORT: SortingState = [{ id: "expenditureDate", desc: true }];

/** All Expenditure list state. Filters (date range, type, category, debounced
 *  search) + sort + page live in the URL so Back/refresh/share restore the view;
 *  the dialog targets (form / category / bill / delete) stay local. */
export function useExpendituresList(actionConfig: ActionConfig) {
  const queryClient = useQueryClient();
  const url = useTableUrlState({ filterKeys: FILTER_KEYS, defaultSort: DEFAULT_SORT });
  const from = url.filters.from || monthStart();
  const to = url.filters.to || today();
  const typeFilter = url.filters.type || "all";
  const categoryFilter = url.filters.categoryId || "all";
  const appliedSearch = url.filters.q;
  const [search, setSearch] = useState(appliedSearch);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expenditure | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [billFor, setBillFor] = useState<Expenditure | null>(null);
  const [deleting, setDeleting] = useState<Expenditure | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== url.filters.q) url.setFilter("q", search.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [search, url]);

  const categoriesQuery = useQuery({
    queryKey: ["expenditure-categories"],
    queryFn: () => apiGet<{ categories: ExpenditureCategory[] }>(actionConfig, "/expenditures/categories"),
  });
  const categories = categoriesQuery.data?.categories ?? [];

  const peopleQuery = useQuery({
    queryKey: ["expenditure-people"],
    queryFn: () => apiGet<{ people: { id: string; name: string }[] }>(actionConfig, "/expenditures/people"),
  });
  const people = peopleQuery.data?.people ?? [];

  const confirmDelete = useCallback(async () => {
    if (!deleting) return;
    try {
      await apiRequest(actionConfig, "DELETE", `/expenditures/${deleting.id}`);
    } catch (e) {
      throw new Error(errorMessage(e, "Could not delete the expenditure."));
    }
    void queryClient.invalidateQueries({ queryKey: ["expenditures"] });
    void queryClient.invalidateQueries({ queryKey: ["expenditure-summary"] });
    setDeleting(null);
  }, [deleting, actionConfig, queryClient]);

  const handleEdit = useCallback((entry: Expenditure) => { setEditing(entry); setFormOpen(true); }, []);
  const columns = useMemo(() => buildExpenditureColumns({ onEdit: handleEdit, onDelete: setDeleting }), [handleEdit]);

  const paged = usePagedTable<Expenditure>({
    actionConfig, queryKey: "expenditures", path: "/expenditures", rowsKey: "rows", columns,
    initialSort: DEFAULT_SORT,
    filters: {
      from, to,
      type: typeFilter === "all" ? "" : typeFilter,
      categoryId: categoryFilter === "all" ? "" : categoryFilter,
      q: appliedSearch,
    },
    sorting: url.sorting,
    onSortingChange: url.setSorting,
    pagination: url.pagination,
    onPaginationChange: url.setPagination,
  });

  return {
    from, to, setPeriod: (f: string, t: string) => url.setFilters({ from: f, to: t || f }),
    typeFilter, setTypeFilter: (v: string) => url.setFilter("type", v === "all" ? "" : v),
    categoryFilter, setCategoryFilter: (v: string) => url.setFilter("categoryId", v === "all" ? "" : v),
    search, setSearch,
    formOpen, setFormOpen, editing, setEditing, categoryOpen, setCategoryOpen,
    billFor, setBillFor, deleting, setDeleting, categories, people, columns,
    confirmDelete, handleEdit,
    openNew: () => { setEditing(null); setFormOpen(true); },
    hasFilters: !!appliedSearch || typeFilter !== "all" || categoryFilter !== "all",
    clearFilters: () => { setSearch(""); url.setFilters({ type: "", categoryId: "" }); },
    ...paged,
  };
}

export type ExpendituresListState = ReturnType<typeof useExpendituresList>;
