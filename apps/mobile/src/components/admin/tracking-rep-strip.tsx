import { Pressable, ScrollView, Text, View } from "react-native";
import { isLive, type TrackedExecutive } from "../../lib/admin-tracking";

/** Horizontal, scrollable strip of tracked reps (SE + Logistics) above the map:
 *  each chip = a live/stale dot + the rep's name; the selected chip is
 *  highlighted. Tap to select (loads route + fits the map), tap again to clear.
 *  Reps with no position yet are dimmed and not selectable. */
export function TrackingRepStrip({
  loading,
  execs,
  selectedId,
  setSelectedId,
}: {
  readonly loading: boolean;
  readonly execs: TrackedExecutive[];
  readonly selectedId: string | null;
  readonly setSelectedId: (id: string | null) => void;
}) {
  return (
    <View className="border-b border-border bg-card">
      {(() => { if (loading && execs.length === 0) return (
        // Skeleton chips while reps load — NOT a spinner, so the only loading
        // indicator on this screen is the map's own loader. Holds the strip's
        // height so chips don't cause a layout jump when they arrive.
        <View className="flex-row gap-2 px-4 py-2.5">
          {[64, 88, 72].map((w, i) => (
            <View key={i} style={{ width: w }} className="h-7 rounded-full bg-secondary" />
          ))}
        </View>
      ); if (execs.length === 0) return (
        <Text className="py-3 text-center text-xs text-muted-foreground">
          No tracking for this day.
        </Text>
      ); return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4 py-2.5"
        >
          {execs.map((e) => {
            const selected = e.userId === selectedId;
            const hasPos = e.lastLatitude != null && e.lastLongitude != null;
            return (
              <Pressable
                key={e.userId}
                disabled={!hasPos}
                onPress={() => setSelectedId(selected ? null : e.userId)}
                className={`flex-row items-center gap-2 rounded-full border px-3 py-1.5 ${
                  selected ? "border-primary bg-primary" : "border-border bg-secondary"
                } ${!hasPos ? "opacity-40" : ""}`}
              >
                <View className={`h-2 w-2 rounded-full ${isLive(e) ? "bg-green-500" : "bg-gray-400"}`} />
                <Text
                  numberOfLines={1}
                  className={`text-xs font-medium ${selected ? "text-primary-foreground" : "text-foreground"}`}
                >
                  {e.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ); })()}
    </View>
  );
}
