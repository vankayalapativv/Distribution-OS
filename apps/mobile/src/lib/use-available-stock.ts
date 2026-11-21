import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "./auth";
import { fetchAvailableStock, type AvailableStock } from "./stock";

/**
 * Backs the Stock screen. Online-only by design (fresh on every open): a plain
 * query with no disk cache, refetched whenever the tab gains focus. Holds the
 * search term and the instant client-side name/brand filter.
 */
export function useAvailableStock() {
  const token = useAuth((s) => s.token);
  const [search, setSearch] = useState("");

  const query = useQuery<AvailableStock>({
    queryKey: ["available-stock"],
    queryFn: () => fetchAvailableStock(token),
    enabled: Boolean(token),
    staleTime: 0,
  });

  // Refetch on focus so the tab always shows live stock when opened.
  const refetch = query.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const data = query.data;
  const products = data?.products; // stable ref from the query cache (or undefined)
  const godowns = useMemo(() => data?.godowns ?? [], [data]);
  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const all = products ?? [];
    if (!term) return all;
    return all.filter(
      (p) => p.productName.toLowerCase().includes(term) || (p.brand ?? "").toLowerCase().includes(term),
    );
  }, [products, term]);

  return { query, search, setSearch, searching: term.length > 0, products: filtered, godowns };
}
