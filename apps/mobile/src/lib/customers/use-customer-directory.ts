import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard } from "react-native";
import { useAuth } from "../auth";
import { cacheKeys } from "../cache-keys";
import { fetchSeCustomers } from "../customer-directory";
import { buildRows, type Row } from "./directory-rows";
import { useCachedQuery } from "../use-cached-query";
import { usePullRefresh } from "../use-pull-refresh";

/** All state, query, and derivations backing the Customers directory screen. */
export function useCustomerDirectory() {
  const token = useAuth((s) => s.token);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  // Debounce the term that drives the filter+sort — the input stays instant, but
  // the whole-directory localeCompare sort only re-runs after typing pauses.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(id);
  }, [search]);
  const listRef = useRef<FlatList<Row>>(null);

  const customersQuery = useCachedQuery({
    queryKey: ["customers"],
    cacheKey: cacheKeys.customersList,
    fetcher: () => fetchSeCustomers(token),
    enabled: Boolean(token),
  });

  // Refetch on focus (silent) so a customer created/edited moments ago shows.
  const refetch = customersQuery.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  // Pull-to-refresh: reset the query so the list drops to the skeleton shimmer
  // (the "fetching" feel, matching Home) and refetches — not a silent swap.
  const { refreshing, onRefresh } = usePullRefresh(() =>
    queryClient.resetQueries({ queryKey: ["customers"] }),
  );

  const customers = customersQuery.data ?? [];
  const query = debouncedSearch.trim().toLowerCase();
  const searching = query.length > 0;
  const { rows, offsets, letterOffset, presentLetters } = useMemo(
    () => buildRows(customers, query, searching),
    [customers, searching, query],
  );
  // Indices of the letter-header rows, so FlatList can pin the current section
  // header to the top while scrolling (the file's promised "sticky headers").
  const stickyHeaderIndices = useMemo(
    () =>
      rows.reduce<number[]>((acc, r, i) => {
        if (r.kind === "header") acc.push(i);
        return acc;
      }, []),
    [rows],
  );

  function jumpTo(letter: string) {
    const offset = letterOffset.get(letter);
    if (offset == null) return;
    Keyboard.dismiss();
    listRef.current?.scrollToOffset({ offset, animated: false });
  }

  const showIndex = !searching && presentLetters.size > 3;

  return {
    search,
    setSearch,
    customersQuery,
    customers,
    searching,
    rows,
    offsets,
    stickyHeaderIndices,
    listRef,
    refreshing,
    onRefresh,
    showIndex,
    presentLetters,
    jumpTo,
  };
}
