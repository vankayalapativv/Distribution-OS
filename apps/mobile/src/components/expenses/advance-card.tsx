import { Pressable, Text, View } from "react-native";

/** Shows the SE's outstanding advance (recovered from salary) and a button to
 *  request a new one. Always visible — the request CTA is useful even at ₹0. */
export function AdvanceCard({
  outstandingTotal,
  onRequest,
}: {
  readonly outstandingTotal: number;
  readonly onRequest: () => void;
}) {
  return (
    <View className="mb-4 rounded-2xl border border-border bg-card p-4">
      {outstandingTotal > 0 ? (
        <>
          <Text className="text-xs text-muted-foreground">Advance to repay</Text>
          <Text className="text-xl font-bold text-foreground">₹{outstandingTotal.toLocaleString("en-IN")}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">Recovered from your salary</Text>
        </>
      ) : (
        <Text className="text-sm text-muted-foreground">Need cash before salary day?</Text>
      )}
      <Pressable className="mt-3 self-start rounded-full bg-secondary px-4 py-2" onPress={onRequest}>
        <Text className="text-sm font-semibold text-primary">Request an advance</Text>
      </Pressable>
    </View>
  );
}
