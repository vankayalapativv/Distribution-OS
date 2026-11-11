/**
 * Home "Today's beat" card — progress summary (done / total, missed) with a thin
 * bar; taps through to the full beat screen. Blanks to a context-aware shimmer on
 * first load and on pull-to-refresh (refreshSignal), matching the other Home
 * cards. Renders nothing once loaded with no stops (Sunday / no beat). Online-only.
 */
import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { fetchTodayBeat, type TodayBeat } from "../../lib/beat/today-beat-online";
import { effectiveStopStatus, isStopDone } from "../../lib/beat/stop-status";
import { BeatCardSkeleton } from "./beat-card-skeleton";

export function BeatCard({
  refreshSignal = 0,
  onSettled,
}: { readonly refreshSignal?: number; readonly onSettled?: () => void } = {}) {
  const token = useAuth((s) => s.token);
  const [beat, setBeat] = useState<TodayBeat | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Focus refetch — silent (keep the current progress on screen while it reloads).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchTodayBeat(token)
        .then((result) => {
          if (!cancelled) setBeat(result);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [token]),
  );

  // Pull-to-refresh — show the shimmer via `refreshing` (NOT by nulling beat),
  // so a FAILED pull keeps the last-good progress instead of vanishing the card.
  useEffect(() => {
    if (refreshSignal === 0) return;
    setRefreshing(true);
    let cancelled = false;
    fetchTodayBeat(token)
      .then((result) => {
        if (!cancelled) setBeat(result);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRefreshing(false);
        onSettled?.(); // report to the Home pull-to-refresh coordinator
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal, token, onSettled]);

  const stops = beat?.stops ?? [];

  // Context-aware shimmer while loading with nothing to show; blank to the same
  // shimmer during a pull; once loaded, hide the card when there are no stops
  // (Sunday / no beat / first fetch failed). A failed pull keeps prior data.
  if (!beat) return loading ? <BeatCardSkeleton /> : null;
  if (refreshing) return <BeatCardSkeleton />;
  if (stops.length === 0) return null;

  const done = stops.filter((s) => isStopDone(s.stopStatus)).length;
  const missed = stops.filter((s) => effectiveStopStatus(s.stopStatus) === "missed").length;
  const pct = Math.round((done / stops.length) * 100);

  return (
    <Pressable
      className="rounded-3xl border border-border bg-card p-4 shadow-sm"
      onPress={() => router.push("/beat")}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-card-foreground">Today&apos;s beat</Text>
        <Text className="text-xs text-muted-foreground">
          {done} of {stops.length} stops done
          {missed > 0 ? <Text className="text-red-600"> · {missed} missed</Text> : null}
        </Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <View className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </View>
    </Pressable>
  );
}
