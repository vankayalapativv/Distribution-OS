import { ActivityIndicator, Pressable, Text, View } from "react-native";

/**
 * Footer Record button. Idle → "Record ₹<amount>"; while submitting → spinner +
 * the current phase status ("Saving…" → "Uploading receipt…").
 */
export function RecordButton({
  canSubmit,
  submitting,
  status,
  amountNum,
  onPress,
}: {
  readonly canSubmit: boolean;
  readonly submitting: boolean;
  readonly status: string;
  readonly amountNum: number;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      className={`items-center rounded-full bg-primary py-3.5 ${canSubmit && !submitting ? "" : "opacity-50"}`}
      onPress={onPress}
      disabled={!canSubmit || submitting}
    >
      {submitting ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator color="#ffffff" />
          <Text className="text-base font-semibold text-primary-foreground">{status}</Text>
        </View>
      ) : (
        <Text className="text-base font-semibold text-primary-foreground">
          Record{amountNum > 0 ? ` ₹${amountNum.toLocaleString("en-IN")}` : " collection"}
        </Text>
      )}
    </Pressable>
  );
}
