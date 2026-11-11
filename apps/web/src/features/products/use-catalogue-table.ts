"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { usePagedTable } from "@/components/data-table/use-paged-table";
import { useTableUrlState } from "@/components/data-table/use-table-url-state";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { oilColumns, oilSkeleton } from "./products-columns";
import { CATALOGUE_META, NOUN, type CatalogueCategory, type CatalogueRow } from "./catalogue-config";
import type { ManagedProduct } from "./products-api";

export interface CatalogueHandlerProps {
  onEditProduct: (p: ManagedProduct) => void;
  onDeleteProduct: (p: ManagedProduct) => void;
}

/** Oils catalogue table state: debounced search, brand filter, columns/skeleton
 *  + paged table. */
const FILTER_KEYS = ["search", "brand"] as const;
/** Sentinel for the brand <Select> meaning "all brands" (Radix forbids "" values). */
export const ALL_BRANDS = "__all__";

export function useCatalogueTable(category: CatalogueCategory, actionConfig: ActionConfig, canManage: boolean, h: CatalogueHandlerProps) {
  const meta = CATALOGUE_META[category];
  const defaultSort: SortingState = useMemo(() => [{ id: meta.sortId, desc: false }], [meta.sortId]);
  // Search + sort + page live in the URL so Back/refresh/share restore the view.
  const url = useTableUrlState({ filterKeys: FILTER_KEYS, defaultSort });
  const appliedSearch = url.filters.search;
  // Brand filter for the oils catalogue.
  const brandFilterable = category === "oils";
  const appliedBrand = brandFilterable ? url.filters.brand : "";
  const [search, setSearch] = useState(appliedSearch);

  // Brand options for the switch (e.g. Fuchs / Savsol) — only fetched for oils.
  const { data: brandData } = useQuery({
    queryKey: ["brands", "oils"],
    queryFn: () => apiGet<{ brands: string[] }>(actionConfig, `/brands?category=oils`),
    enabled: brandFilterable,
  });
  const brandOptions = brandData?.brands ?? [];
  const brand = appliedBrand || ALL_BRANDS;
  const setBrand = (value: string | null) =>
    url.setFilter("brand", !value || value === ALL_BRANDS ? "" : value);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== url.filters.search) url.setFilter("search", search.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [search, url]);

  const columns = useMemo(
    () => oilColumns({ onEdit: h.onEditProduct, onDelete: h.onDeleteProduct, canManage }),
    [h.onEditProduct, h.onDeleteProduct, canManage],
  ) as ColumnDef<CatalogueRow>[];
  const skeleton = oilSkeleton;

  const paged = usePagedTable<CatalogueRow>({
    actionConfig, queryKey: meta.queryKey, path: meta.path, rowsKey: meta.rowsKey,
    columns, initialSort: defaultSort, filters: { search: appliedSearch, brand: appliedBrand },
    sorting: url.sorting, onSortingChange: url.setSorting,
    pagination: url.pagination, onPaginationChange: url.setPagination,
  });

  return {
    search, setSearch, appliedSearch,
    brandFilterable, brand, setBrand, brandOptions,
    columns, skeleton, noun: NOUN[category], ...paged,
  };
}
