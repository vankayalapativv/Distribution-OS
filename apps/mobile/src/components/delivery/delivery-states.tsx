import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomInset } from "../../lib/use-bottom-inset";
import { DeliveryHeader } from "./delivery-header";

/** Initial load spinner. */
export function DeliveryLoading() {
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <DeliveryHeader title="Deliveries" />
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#3b82f6" />
      </View>
    </SafeAreaView>
  );
}

export function AllDoneView({
  vehicle, stops, km, onDone,
}: {
  readonly vehicle: string;
  readonly stops: number;
  readonly km: number | null;
  readonly onDone: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <DeliveryHeader title="Deliveries" />
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-2xl font-bold text-foreground">All done!</Text>
        <Text className="text-center text-muted-foreground">
          Vehicle {vehicle} · {stops} deliver{stops === 1 ? "y" : "ies"}
          {km != null ? ` · ${km} KM` : ""}
        </Text>
        <Pressable className="mt-4 items-center self-stretch rounded-full bg-primary py-3.5" onPress={onDone}>
          <Text className="font-semibold text-primary-foreground">Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function IdleView({
  userName, onStart,
}: {
  readonly userName: string;
  readonly onStart: () => void;
}) {
  const bottomPad = useBottomInset();
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <DeliveryHeader title="Deliveries" sub={`${userName} · Logistics`} />
      <View className="flex-1 items-center justify-center px-8">
        <View className="items-center gap-2 rounded-3xl border border-border bg-card px-6 py-8">
          <Text className="text-lg font-bold text-foreground">Ready to start</Text>
          <Text className="text-center text-sm text-muted-foreground">Add your vehicle and meter reading to start.</Text>
        </View>
      </View>
      <View className="border-t border-border bg-card px-5 pt-3" style={{ paddingBottom: bottomPad }}>
        <Pressable className="items-center rounded-full bg-primary py-3.5" onPress={onStart}>
          <Text className="text-base font-semibold text-primary-foreground">Start Deliveries</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
