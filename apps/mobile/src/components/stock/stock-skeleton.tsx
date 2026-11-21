import { View } from "react-native";

/** Loading placeholder rows that mirror the collapsed product-row shape. */
export function StockSkeleton() {
  return (
    <View className="px-5 pt-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} className="flex-row items-center gap-3 border-b border-border py-4">
          <View className="flex-1 gap-2">
            <View className="h-3.5 rounded bg-muted" style={{ width: 168 }} />
            <View className="h-2.5 rounded bg-muted" style={{ width: 88 }} />
          </View>
          <View className="h-5 w-9 rounded bg-muted" />
        </View>
      ))}
    </View>
  );
}
