import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomInset } from "../../lib/use-bottom-inset";
import type { Product } from "../../lib/order/types";
import type { OrderCart } from "../../lib/order/use-order-cart";
import { OrderHeader } from "./order-header";
import { ErrorBanner } from "../error-banner";
import { ReviewLines } from "./review-lines";
import { ReviewTotals } from "./review-totals";

/** S5b editable review: cart lines, totals table, and the Submit action. */
export function ReviewScreen({
  cart,
  products,
  customerName,
  onBack,
  onSubmit,
  submitting,
  error,
}: Readonly<{
  cart: OrderCart;
  products: Product[];
  customerName?: string;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}>) {
  const bottomPad = useBottomInset();
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <OrderHeader title="Review" subtitle={customerName} onBack={onBack} />
      <ReviewLines cart={cart} products={products} onAddMore={onBack} />
      <View className="px-4 pb-2 pt-3">
        <ReviewTotals cart={cart} />
      </View>
      <View className="border-t border-border bg-card px-5 pt-3" style={{ paddingBottom: bottomPad }}>
        {error ? <ErrorBanner message={error} className="mb-2" /> : null}
        <Pressable
          className={`items-center rounded-full bg-primary py-3.5 ${
            cart.canSubmit && !submitting ? "" : "opacity-40"
          }`}
          onPress={onSubmit}
          disabled={!cart.canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-sm font-semibold text-primary-foreground">Submit order</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
