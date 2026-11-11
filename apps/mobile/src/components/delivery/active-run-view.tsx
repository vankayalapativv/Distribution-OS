import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type LocalDeliveryStop } from "../../lib/sync-core";

export interface ActiveRunViewProps {
  vehicleNumber: string;
  stops: LocalDeliveryStop[];
  refreshing: boolean;
  onRefresh: () => void;
  onAdd: () => void;
  onEndPress: () => void;
}

export function ActiveRunView(p: Readonly<ActiveRunViewProps>) {
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-bold text-foreground">Deliveries</Text>
          <Text className="text-sm text-muted-foreground">
            Vehicle {p.vehicleNumber} · {p.stops.length} done
          </Text>
        </View>
        <Pressable onPress={p.onEndPress} hitSlop={8} className="rounded-full border border-destructive bg-red-50 px-4 py-2">
          <Text className="text-sm font-bold text-destructive">End</Text>
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 py-4"
        refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} />}
      >
        <Pressable className="items-center rounded-full bg-primary py-3.5" onPress={p.onAdd}>
          <Text className="text-base font-semibold text-primary-foreground">+ Add delivery</Text>
        </Pressable>
        <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Deliveries done ({p.stops.length})
        </Text>
        {p.stops.length === 0 ? (
          <View className="items-center rounded-3xl border border-dashed border-border py-8">
            <Text className="text-center text-sm text-muted-foreground">
              No deliveries yet. Tap + Add delivery at your first stop.
            </Text>
          </View>
        ) : (
          p.stops.map((s) => (
            <View key={s.clientUuid} className="rounded-3xl border border-border bg-card p-3">
              <Text className="font-medium text-card-foreground">{s.customerName ?? "Customer"}</Text>
              <Text className="text-xs text-muted-foreground">
                {s.photoCount} photo{s.photoCount === 1 ? "" : "s"}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
