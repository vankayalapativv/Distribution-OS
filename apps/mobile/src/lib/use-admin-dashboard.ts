/**
 * SA Home dashboard state: range-scoped KPI metrics with focus refetch + pull-
 * to-refresh. Online-only. Changing the range clears metrics synchronously so
 * the KPI cards shimmer immediately (no blank frame) while the new range loads.
 */
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { fetchDashboardMetrics, istToday, type DashboardMetrics } from "./admin-dashboard";

export function useAdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  // Keep the RAW thrown value (not a flattened string) so the UI can humanize it
  // with a severity + friendly title via <ErrorState>.
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState(() => {
    const t = istToday();
    return { from: t, to: t };
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      setMetrics(await fetchDashboardMetrics(range.from, range.to));
    } catch (e) {
      setError(e);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Blank the metrics so the KPI grid drops to its skeleton on pull (same
    // "fetching" shimmer as first open), then reload. Focus refetches stay silent.
    setMetrics(null);
    await load();
    setRefreshing(false);
  }, [load]);

  const applyRange = useCallback((from: string, to: string) => {
    setMetrics(null);
    setRange({ from, to });
  }, []);

  const isToday = range.from === istToday() && range.to === istToday();

  return { metrics, error, refreshing, range, isToday, load, onRefresh, applyRange };
}
