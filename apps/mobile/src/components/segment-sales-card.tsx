/**
 * SA Home "Sales by segment" card: every active SE's oil litres split across the
 * 6 segments for the selected period (Today / Week / Month). Rows rank by total
 * litres (zero-sale SEs dropped); each row shows a stacked segment bar, and taps
 * to expand the full per-segment breakdown. Online-only (react-query). Sits under
 * the Leaderboard, which shows the same SEs by TOTAL litres.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { LeaderPeriod } from "../lib/leaderboard";
import { rankSegmentSales, type SegmentSalesRow } from "../lib/segment-sales";
import { SegmentRow } from "./segment-sales-row";
import { SegmentSalesSkeleton } from "./segment-sales-skeleton";
import { ErrorState } from "./error-state";

const PERIODS: LeaderPeriod[] = ["today", "week", "month"];

export function SegmentSalesCard({ refreshSignal = 0 }: { readonly refreshSignal?: number } = {}) {
  const token = useAuth((s) => s.token);
  const [period, setPeriod] = useState<LeaderPeriod>("today");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["segment-sales"],
    queryFn: () => apiFetch<{ rows: SegmentSalesRow[] }>("/leaderboard/segments", { token }),
    enabled: Boolean(token),
  });
  // Pull-to-refresh: reset so the card drops to its skeleton and refetches.
  useEffect(() => {
    if (refreshSignal > 0) void queryClient.resetQueries({ queryKey: ["segment-sales"] });
  }, [refreshSignal, queryClient]);
  // Refetch on Home refocus — silent (keeps current rows while it reloads).
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const ranked = rankSegmentSales(query.data?.rows ?? [], period);

  return (
    <View className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-card-foreground">Sales by segment</Text>
        <View className="flex-row rounded-lg bg-secondary p-0.5">
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              className={`rounded-md px-2.5 py-1 ${period === p ? "bg-card" : ""}`}
              onPress={() => setPeriod(p)}
            >
              <Text
                className={`text-xs font-medium capitalize ${
                  period === p ? "text-card-foreground" : "text-muted-foreground"
                }`}
              >
                {p}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Litres per segment
      </Text>

      {(() => {
        if (query.isPending) {
          return <SegmentSalesSkeleton />;
        }
        if (query.isError) {
          return <ErrorState compact error={query.error} onRetry={query.refetch} />;
        }
        if (ranked.length === 0) {
          return (
            <Text className="py-4 text-center text-xs text-muted-foreground">
              No oil sales yet {period === "today" ? "today" : `this ${period}`}.
            </Text>
          );
        }
        return (
          <View>
            {ranked.map((r, i) => (
              <SegmentRow
                key={r.userId}
                row={r}
                first={i === 0}
                expanded={expandedId === r.userId}
                onToggle={() => setExpandedId(expandedId === r.userId ? null : r.userId)}
              />
            ))}
          </View>
        );
      })()}
    </View>
  );
}
