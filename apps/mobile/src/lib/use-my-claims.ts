import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useAuth } from "./auth";
import { fetchMyClaims, type ExpenseClaim } from "./expense-claims";
import { usePullRefresh } from "./use-pull-refresh";

/**
 * The SE/Logistics "my expense claims" list — online-only (React Query), refetched
 * on focus and on pull-to-refresh. Mirrors use-available-stock.
 */
export function useMyClaims() {
  const token = useAuth((s) => s.token);
  const query = useQuery<ExpenseClaim[]>({
    queryKey: ["my-claims"],
    queryFn: () => fetchMyClaims(token),
    enabled: Boolean(token),
    staleTime: 0,
  });

  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  const { refreshing, onRefresh } = usePullRefresh(async () => { await refetch(); });

  const claims = query.data ?? [];
  return {
    claims,
    loading: query.isPending,
    error: query.isError && claims.length === 0 ? query.error : null,
    retry: refetch,
    refreshing,
    onRefresh,
  };
}
