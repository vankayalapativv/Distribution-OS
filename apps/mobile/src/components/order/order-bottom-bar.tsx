import { Pressable, Text, View } from "react-native";
import { useBottomInset } from "../../lib/use-bottom-inset";
import type { OrderCart } from "../../lib/order/use-order-cart";

/** Sticky bottom bar: a hint when empty, else a totals summary + Review button. */
export function OrderBottomBar({ cart, onReview }: Readonly<{ cart: OrderCart; onReview: () => void }>) {
  const bottomPad = useBottomInset();
  return (
    <View
      className="flex-row items-center gap-3 border-t border-border bg-card px-5 pt-3"
      style={{ paddingBottom: bottomPad }}
    >
      {cart.cartCount === 0 ? (
        <Text className="flex-1 py-1 text-center text-sm text-muted-foreground">
          Tap an item to add it to the order
        </Text>
      ) : (
        <>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">
              {`${cart.totalLines} item${cart.totalLines === 1 ? "" : "s"} · ${cart.totalLitres} L`}
            </Text>
          </View>
          <Pressable className="rounded-full bg-primary px-7 py-3" onPress={onReview}>
            <Text className="text-sm font-semibold text-primary-foreground">Review</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
