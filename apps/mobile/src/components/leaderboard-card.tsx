/**
 * Home-screen "Leaderboard" card: every active SE ranked by oil litres for the
 * selected period (Today / Week / Month). Same framed look as the performance
 * card; the viewer's own row is highlighted. Top three get gold/silver/bronze
 * medals, ranks 4+ a numbered circle. Zero-sale SEs are dropped. Online-only
 * (react-query).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { rankByPeriod, type LeaderboardRow, type LeaderPeriod } from "../lib/leaderboard";
import { LeaderboardRows, LeaderboardRowsSkeleton } from "./home/leaderboard-rows";
import { ErrorState } from "./error-state";

const PERIODS: LeaderPeriod[] = ["today", "week", "month"];

export function LeaderboardCard({
  refreshSignal = 0,
  onSettled,
}: { readonly refreshSignal?: number; readonly onSettled?: () => void } = {}) {
  const token = useAuth((s) => s.token);
  const myId = useAuth((s) => s.user?.id ?? null);
  const [period, setPeriod] = useState<LeaderPeriod>("today");

  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => apiFetch<{ leaderboard: LeaderboardRow[] }>("/leaderboard", { token }),
    enabled: Boolean(token),
  });
  // On Home pull-to-refresh (refreshSignal bumps), reset the query so the card
  // drops to its skeleton and refetches — the "fetching" shimmer, not a silent swap.
  useEffect(() => {
    if (refreshSignal === 0) return;
    // resetQueries resolves after the refetch, so this reports real completion to
    // the Home pull-to-refresh coordinator.
    void queryClient.resetQueries({ queryKey: ["leaderboard"] }).finally(() => onSettled?.());
  }, [refreshSignal, queryClient, onSettled]);
  // Refetch on Home refocus — silent (react-query keeps the current rows while it
  // reloads), so returning after booking an order updates the ranking. The other
  // Home cards refetch on focus too; RN doesn't wire query focus by default.
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const ranked = rankByPeriod(query.data?.leaderboard ?? [], period, myId);

  return (
    <View className="border border-border bg-card p-4 rounded-3xl shadow-sm">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-card-foreground">Leaderboard</Text>
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
        Oil litres ranking
      </Text>

      {(() => {
        if (query.isPending) {
          return <LeaderboardRowsSkeleton />;
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
        return <LeaderboardRows ranked={ranked} />;
      })()}
    </View>
  );
}
