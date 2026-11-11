import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StopRow } from "../components/beat/stop-row";
import { Icon } from "../components/icon";
import { CardRowSkeleton, SkeletonList } from "../components/skeleton";
import { useTodayBeat } from "../lib/beat/use-today-beat";
import { effectiveStopStatus, isStopDone } from "../lib/beat/stop-status";
import { usePullRefresh } from "../lib/use-pull-refresh";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Today";
  // Parse a bare "YYYY-MM-DD" as LOCAL midnight, not UTC — `new Date("2026-08-20")`
  // is UTC midnight, which renders as the previous day on a device west of UTC.
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Today";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** S4 — Today's Beat: ordered stop list with per-stop status. Online-only. */
export default function BeatScreen() {
  const { beat, loading, refresh } = useTodayBeat();
  const { refreshing, onRefresh } = usePullRefresh(refresh);
  const stops = beat?.stops ?? [];
  const done = stops.filter((s) => isStopDone(s.stopStatus)).length;
  const missed = stops.filter((s) => effectiveStopStatus(s.stopStatus) === "missed").length;

  const missedLabel = missed > 0 ? ` · ${missed} missed` : "";
  const progress = stops.length ? `${done} of ${stops.length} done${missedLabel}` : "";
  const subtitle = [formatDate(beat?.planDate), progress].filter(Boolean).join(" · ");

  return (
    <SafeAreaView className="flex-1 bg-secondary">
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevron-back" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">Today&apos;s beat</Text>
          <Text className="text-xs text-muted-foreground">{subtitle}</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-5 py-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {(() => { if ((loading && !beat) || refreshing) return (
          <SkeletonList count={11} row={CardRowSkeleton} />
        ); if (stops.length === 0) return (
          <View className="mt-24 items-center gap-2 px-6">
            <Icon name="map-outline" size={40} color="#94a3b8" />
            <Text className="text-center text-base font-semibold text-foreground">
              No beat today
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              You have no planned stops for today. Enjoy the lighter day.
            </Text>
          </View>
        ); return (
          stops.map((stop) => <StopRow key={stop.stopId} stop={stop} />)
        ); })()}
      </ScrollView>
    </SafeAreaView>
  );
}
