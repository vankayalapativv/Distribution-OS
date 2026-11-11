"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";

export interface CustomerOption {
  id: string;
  legalName: string;
  phone?: string | null;
  addressCity?: string | null;
  salesExecutiveName?: string | null;
}

/** Phone · City · Executive on one line beneath the name (any may be absent). */
export function buildMeta(c: CustomerOption): string {
  return [c.phone, c.addressCity, c.salesExecutiveName].filter(Boolean).join(" · ");
}

/** The dropdown's empty-state copy, chosen from the current search/seed state. */
export function resolveEmptyText(
  isFetching: boolean,
  debouncedLen: number,
  seedLen: number,
  emptyText: string,
): string {
  if (isFetching) return "Searching…";
  if (debouncedLen > 0 || seedLen) return emptyText;
  return "Type a name, phone or city to search";
}

/** Server-search-as-you-type state for the customer picker. Debounces the box
 *  into a `/customers?search=` query, falls back to `seedItems`, and resolves the
 *  trigger label even for a pick made outside the seed list. */
export function useCustomerSearch({
  actionConfig,
  valueKey,
  seedItems,
  selectedLabel,
}: {
  actionConfig: ActionConfig;
  valueKey: string;
  seedItems: CustomerOption[];
  selectedLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [chosen, setChosen] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isFetching } = useQuery({
    queryKey: ["customer-search", debounced],
    queryFn: () =>
      apiGet<CustomerOption[]>(actionConfig, `/customers?search=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length > 0,
    staleTime: 30_000,
  });

  const seedMap = useMemo(() => new Map(seedItems.map((c) => [c.id, c.legalName])), [seedItems]);
  const list: CustomerOption[] = debounced.length > 0 ? (data ?? []) : seedItems;
  let selectedName = "";
  if (valueKey) {
    selectedName = chosen?.id === valueKey ? chosen.label : (seedMap.get(valueKey) ?? selectedLabel ?? "");
  }

  function close() {
    setOpen(false);
    setSearch("");
    setDebounced("");
  }

  function choose(c: CustomerOption) {
    setChosen({ id: c.id, label: c.legalName });
  }

  // Shimmer while a search is pending: from the first typed character (before the
  // debounce settles) until the matching fetch resolves. Empty box → not loading.
  const trimmed = search.trim();
  const loading = trimmed.length > 0 && (trimmed !== debounced || isFetching);

  return { open, setOpen, search, setSearch, debounced, list, isFetching, loading, selectedName, close, choose };
}
