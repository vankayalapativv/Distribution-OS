/**
 * Home-screen "Collection dues" card: outstanding total + a flat ageing strip
 * (0–30 / 31–45 / 46–60 / 61+ days, from the oldest unpaid invoice's date).
 * Each column taps through to that bucket's customer list. Online-only.
 */
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchDuesSummary, type DuesSummary } from "../lib/dues";
import { DuesCardSkeleton } from "./home/dues-card-skeleton";
import { DuesCardStrip } from "./home/dues-card-strip";

export function DuesCard({
  refreshSignal = 0,
  onSettled,
}: { readonly refreshSignal?: number; readonly onSettled?: () => void } = {}) {
  const [summary, setSummary] = useState<DuesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Focus refetch — silent (keep the current numbers while it reloads).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchDuesSummary().then((result) => {
        if (cancelled) return;
        if (result) setSummary(result);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Pull-to-refresh — show the shimmer via `refreshing` (NOT by nulling summary),
  // so a FAILED pull keeps the last-good data instead of vanishing the card.
  useEffect(() => {
    if (refreshSignal === 0) return;
    setRefreshing(true);
    let cancelled = false;
    void fetchDuesSummary()
      .then((result) => {
        if (cancelled) return;
        if (result) setSummary(result);
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
  if (!summary) return loading ? <DuesCardSkeleton /> : null;
  if (refreshing) return <DuesCardSkeleton />;

  const empty = summary.totalCustomers === 0;

  return (
    <View className="rounded-3xl shadow-sm border border-border bg-card p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-card-foreground">Collection dues</Text>
        {!empty ? <Text className="text-xs text-muted-foreground">tap a bucket</Text> : null}
      </View>

      {empty ? (
        <Text className="py-2 text-center text-sm text-muted-foreground">
          No customers with outstanding dues.
        </Text>
      ) : (
        <>
          <Text className="text-2xl font-extrabold text-card-foreground">
            ₹{summary.totalOutstanding.toLocaleString("en-IN")}
          </Text>
          <Text className="mb-3 mt-0.5 text-xs text-muted-foreground">
            outstanding · {summary.totalCustomers}{" "}
            {summary.totalCustomers === 1 ? "customer" : "customers"}
          </Text>

          <DuesCardStrip buckets={summary.buckets} />
        </>
      )}
    </View>
  );
}
