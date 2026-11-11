/**
 * Home-screen "My performance" card: Today / Week / Month tabs.
 * Two lead stats (oil total vs target + collected ₹) carry the headline; a
 * per-segment oil list sits below (zero segments collapse to "—").
 * Oils = ordered (per order-line segment).
 * Today shows actuals only. Online-only — shimmers on first load, then null on
 * a failed fetch (no data to show).
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchMyPerformance, type MyPerformance } from "../lib/performance";
import { PerformanceCardBody } from "./home/performance-card-body";
import { PerformanceCardSkeleton } from "./home/performance-card-skeleton";

type Tab = "today" | "week" | "month";

export function PerformanceCard({
  refreshSignal = 0,
  onSettled,
}: { readonly refreshSignal?: number; readonly onSettled?: () => void } = {}) {
  const [tab, setTab] = useState<Tab>("today");
  const [perf, setPerf] = useState<MyPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Focus refetch — silent (keep the current numbers while it reloads).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchMyPerformance().then((result) => {
        if (cancelled) return;
        if (result) setPerf(result);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Pull-to-refresh — show the shimmer via `refreshing` (NOT by nulling perf),
  // so a FAILED pull keeps the last-good data instead of vanishing the card.
  useEffect(() => {
    if (refreshSignal === 0) return;
    setRefreshing(true);
    let cancelled = false;
    void fetchMyPerformance()
      .then((result) => {
        if (cancelled) return;
        if (result) setPerf(result);
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
        onSettled?.(); // report to the Home pull-to-refresh coordinator
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal, onSettled]);

  // Context-aware shimmer on first load; hide the card only if the FIRST fetch
  // failed (nothing to show). A failed pull-refresh falls through to prior data.
  if (!perf) return loading ? <PerformanceCardSkeleton /> : null;
  if (refreshing) return <PerformanceCardSkeleton />;

  return (
    <View className=" border border-border bg-card p-4 rounded-3xl shadow-sm">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-card-foreground">My performance</Text>
        <View className="flex-row rounded-lg bg-secondary p-0.5">
          {(["today", "week", "month"] as const).map((t) => (
            <Pressable
              key={t}
              className={`rounded-md px-2.5 py-1 ${tab === t ? "bg-card" : ""}`}
              onPress={() => setTab(t)}
            >
              <Text
                className={`text-xs font-medium capitalize ${
                  tab === t ? "text-card-foreground" : "text-muted-foreground"
                }`}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <PerformanceCardBody perf={perf} tab={tab} />
    </View>
  );
}
