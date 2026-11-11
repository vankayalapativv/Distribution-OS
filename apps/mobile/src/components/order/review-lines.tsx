import { Pressable, ScrollView, Text, View } from "react-native";
import { packLabel } from "../../lib/format";
import type { Product } from "../../lib/order/types";
import type { OrderCart } from "../../lib/order/use-order-cart";
import { QtyField } from "./qty-field";

const RemoveX = ({ onPress }: { readonly onPress: () => void }) => (
  <Pressable onPress={onPress} hitSlop={8}>
    <Text className="text-base text-muted-foreground">✕</Text>
  </Pressable>
);

/** Scrollable editable list of cart lines (oils) + "Add more". */
export function ReviewLines({
  cart,
  products,
  onAddMore,
}: Readonly<{
  cart: OrderCart;
  products: Product[];
  onAddMore: () => void;
}>) {
  return (
    <ScrollView
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-2 px-4 pb-3 pt-3"
    >
      {cart.orderedProductIds.flatMap((id) =>
        cart.cart[id].map((l, i) => (
          <View
            key={`${id}-${i}`}
            className="flex-row items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3"
          >
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
                {products.find((p) => p.id === id)?.productName ?? id}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {l.packSizeLitres != null ? packLabel(l.packSizeLitres) : "By the piece"}
              </Text>
            </View>
            <QtyField
              compact
              value={l.quantityUnits >= 1 ? String(l.quantityUnits) : ""}
              onChange={(t) => cart.setLineQty(id, i, t)}
            />
            <RemoveX onPress={() => cart.removeLine(id, i)} />
          </View>
        )),
      )}

      <Pressable
        className="mt-2 w-1/2 items-center self-center rounded-full border border-primary py-2.5"
        onPress={onAddMore}
      >
        <Text className="text-sm font-semibold text-primary">＋ Add more</Text>
      </Pressable>
    </ScrollView>
  );
}
