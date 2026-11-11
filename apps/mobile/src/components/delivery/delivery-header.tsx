import { Text, View } from "react-native";

/** Shared screen header for the delivery flow. */
export function DeliveryHeader({ title, sub }: { readonly title: string; readonly sub?: string }) {
  return (
    <View className="border-b border-border px-5 py-4">
      <Text className="text-xl font-bold text-foreground">{title}</Text>
      {sub ? <Text className="text-sm text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}
