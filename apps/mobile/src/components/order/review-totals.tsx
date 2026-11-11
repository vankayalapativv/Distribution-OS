import { Text, View } from "react-native";
import type { OrderCart } from "../../lib/order/use-order-cart";

/** Totals table on the review screen (oils). */
export function ReviewTotals({ cart }: Readonly<{ cart: OrderCart }>) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      <View className="flex-row">
        <View className="flex-1 border-r border-border px-4 py-2.5">
          <Text className="text-sm font-medium text-muted-foreground">Total oils</Text>
        </View>
        <View className="flex-1 px-4 py-2.5">
          <Text className="text-right text-sm text-foreground">
            {cart.totalLines} item{cart.totalLines === 1 ? "" : "s"} · {cart.totalLitres} L
          </Text>
        </View>
      </View>
    </View>
  );
}
