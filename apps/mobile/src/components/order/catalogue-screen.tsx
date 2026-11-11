import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Product } from "../../lib/order/types";
import { useCatalogue } from "../../lib/order/use-catalogue";
import type { OrderCart } from "../../lib/order/use-order-cart";
import { OfflineBanner } from "../offline-banner";
import { CatalogueHeader } from "./catalogue-header";
import { CatalogueList } from "./catalogue-list";
import { OrderBottomBar } from "./order-bottom-bar";
import { OrderHeader } from "./order-header";
import { PackSheet } from "./pack-sheet";

/** S5 "Pick" screen — search + brand tabs + catalogue list + bottom bar + pack sheet. */
export function CatalogueScreen({
  customerName,
  products,
  creditUnknown,
  cart,
  onReview,
  offline = false,
}: {
  readonly customerName?: string;
  readonly products: Product[];
  readonly creditUnknown: boolean;
  readonly cart: OrderCart;
  readonly onReview: () => void;
  /** True when the catalogue came from the local cache (no network). */
  readonly offline?: boolean;
}) {
  const c = useCatalogue({ products, cart });
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <OrderHeader
        title="New order"
        subtitle={customerName}
        onBack={() => router.back()}
        right={
          cart.cartCount > 0 ? (
            <Pressable onPress={onReview} hitSlop={8}>
              <Text className="text-sm font-semibold text-primary">Cart · {cart.cartCount}</Text>
            </Pressable>
          ) : undefined
        }
      />
      {offline ? <OfflineBanner className="mx-4 mt-2" /> : null}
      <CatalogueHeader
        brands={c.availableBrands}
        brand={c.brand}
        onBrand={c.selectBrand}
        search={c.search}
        onSearch={c.setSearch}
        segments={c.availableSegments}
        segmentFilter={c.segmentFilter}
        onSegment={c.setSegmentFilter}
        creditUnknown={creditUnknown}
      />
      <CatalogueList
        products={c.filteredProducts}
        cart={cart}
        onOpen={c.setSheetProduct}
        onAddOrOpen={c.addOrOpen}
      />
      <OrderBottomBar cart={cart} onReview={onReview} />
      <PackSheet
        product={c.sheetProduct}
        lines={c.sheetProduct ? cart.cart[c.sheetProduct.id] ?? [] : []}
        defaultPack={c.defaultPack}
        onClose={() => c.setSheetProduct(null)}
        onAdd={c.addFromSheet}
        onRemoveLine={(i) => c.sheetProduct && cart.removeLine(c.sheetProduct.id, i)}
      />
    </SafeAreaView>
  );
}
