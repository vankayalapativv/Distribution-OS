import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PAYMENT_MODES } from "../../lib/collection/constants";

/** S8 confirmation: shows the server collection code, or a "saved offline, will
 *  sync" state when the collection was queued without a connection. */
export function CollectionConfirmation({
  code,
  queued = false,
  amountNum,
  mode,
  collectionType,
  onReset,
}: {
  readonly code: string;
  /** True when saved offline (no server code yet; the proof uploads on sync). */
  readonly queued?: boolean;
  readonly amountNum: number;
  readonly mode: string;
  readonly collectionType: "general" | "advance";
  readonly onReset: () => void;
}) {
  const modeLabel = PAYMENT_MODES.find((m) => m.key === mode)?.label;
  const typeLabel = collectionType === "advance" ? "advance" : "general";
  return (
    <SafeAreaView className="flex-1 bg-secondary">
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <Text className="text-4xl">✓</Text>
        </View>
        <Text className="text-xl font-bold text-foreground">
          {queued ? "Collection saved" : "Collection recorded"}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {queued ? modeLabel : `${code} · ${modeLabel}`} · {typeLabel} payment
        </Text>
        <Text className="text-sm text-muted-foreground">
          ₹{amountNum.toLocaleString("en-IN")}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {queued
            ? "Saved on this device — syncs automatically when you're back online."
            : "Pending accountant verification."}
        </Text>
        <Pressable
          className="mt-4 items-center self-stretch rounded-full bg-primary py-3.5"
          onPress={() => router.back()}
        >
          <Text className="font-semibold text-primary-foreground">Back to customer</Text>
        </Pressable>
        <Pressable className="items-center self-stretch py-3" onPress={onReset}>
          <Text className="font-semibold text-primary">Start another</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
