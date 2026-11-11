import { FlatList, Text } from "react-native";
import type { OrderLine, Product } from "../../lib/order/types";
import type { OrderCart } from "../../lib/order/use-order-cart";
import { ProductRow } from "./product-row";

const empty = (msg: string) => (
  <Text className="py-10 text-center text-sm text-muted-foreground">{msg}</Text>
);

// One shared empty array for products with no cart lines — a fresh `[]` literal
// per render would give every uncarted row a new `lines` prop and defeat memo.
const NO_LINES: OrderLine[] = [];

/** The scrollable catalogue body — the selected brand's oils. */
export function CatalogueList({
  products,
  cart,
  onOpen,
  onAddOrOpen,
}: {
  readonly products: Product[];
  readonly cart: OrderCart;
  readonly onOpen: (p: Product) => void;
  readonly onAddOrOpen: (p: Product) => void;
}) {
  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-2 px-4 py-2.5"
      ListEmptyComponent={empty("No products match your search.")}
      renderItem={({ item: p }) => (
        <ProductRow
          product={p}
          lines={cart.cart[p.id] ?? NO_LINES}
          onOpen={onOpen}
          onAdd={onAddOrOpen}
          onQty={cart.setLineQty}
          onRemove={cart.removeLine}
        />
      )}
    />
  );
}
