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

  // Punctuation-insensitive, AND-per-word search over name + brand. Viscosity
  // grades carry hyphens ("5W-30", "15W-40", "CI-4+"), and SEs type them with or
  // without the dash/space — so strip every non-alphanumeric char from BOTH the
  // haystack and each query word, then require every query word to appear. That
  // makes "5w30", "5w-30" and "5w 30" all match "5W-30", while a multi-word query
  // like "fuchs 5w30" still needs both parts present.
  const tokens = useMemo(
    () =>
      search
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9]/g, ""))
        .filter(Boolean),
    [search],
  );
  const filtered = useMemo(() => {
    const all = products ?? [];
    if (tokens.length === 0) return all;
    return all.filter((p) => {
      const hay = `${p.productName} ${p.brand ?? ""}`.toLowerCase().replace(/[^a-z0-9]/g, "");
      return tokens.every((t) => hay.includes(t));
    });
  }, [products, tokens]);

  return { query, search, setSearch, searching: tokens.length > 0, products: filtered, godowns };
}
